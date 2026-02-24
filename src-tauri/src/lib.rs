mod db;

use serde::Serialize;
use std::{
    fs,
    path::{Path, PathBuf},
    sync::Mutex,
};

use tauri::Manager;

#[cfg(not(any(target_os = "android", target_os = "ios")))]
use tauri::Emitter;
#[cfg(not(any(target_os = "android", target_os = "ios")))]
use tauri_plugin_global_shortcut::ShortcutState;
#[cfg(any(
    target_os = "macos",
    target_os = "windows",
    target_os = "linux",
    target_os = "ios"
))]
use keyring::Entry;
#[cfg(target_os = "android")]
use std::{sync::mpsc, time::Duration};

#[cfg(not(any(target_os = "android", target_os = "ios")))]
const QUICK_CAPTURE_EVENT: &str = "quick-capture:open";
const CURRENT_BUNDLE_IDENTIFIER: &str = "com.solutionsstudio.solostack";
const LEGACY_BUNDLE_IDENTIFIER: &str = "com.antigravity.solostack";
const DATABASE_FILENAME: &str = "solostack.db";
const STARTUP_MIGRATION_MARKER_FILENAME: &str = "startup-migration-v1.json";
const SYNC_PROVIDER_AUTH_SERVICE: &str = "com.solutionsstudio.solostack.sync-provider-auth";
const SYNC_PROVIDER_AUTH_SELF_TEST_ACCOUNT: &str = "sync-provider-secure-store-self-test";
const SYNC_PROVIDER_AUTH_SELF_TEST_PAYLOAD: &str = "solostack-secure-store-self-test";
#[cfg(target_os = "android")]
const ANDROID_SYNC_PROVIDER_SECURE_STORE_CLASS: &str = "com.solutionsstudio.solostack.SyncProviderSecureStore";
#[cfg(target_os = "android")]
const ANDROID_SECURE_STORE_TIMEOUT_MS: u64 = 5_000;

#[derive(Clone, Serialize, Default)]
struct StartupMigrationReport {
    legacy_path_detected: bool,
    marker_present: bool,
    migration_attempted: bool,
    migration_completed: bool,
    migration_error: Option<String>,
    legacy_db_path: Option<String>,
    new_db_path: Option<String>,
}

#[derive(Serialize)]
struct StartupMigrationMarkerPayload {
    version: u8,
    source_db_path: String,
    destination_db_path: String,
}

#[derive(Clone, Serialize)]
struct SyncProviderSecureStoreSelfTestResult {
    runtime: String,
    backend: String,
    available: bool,
    write_ok: bool,
    read_ok: bool,
    delete_ok: bool,
    roundtrip_ok: bool,
    detail: Option<String>,
}

struct StartupMigrationState(Mutex<StartupMigrationReport>);

#[tauri::command]
fn get_startup_migration_report(
    state: tauri::State<StartupMigrationState>,
) -> StartupMigrationReport {
    match state.0.lock() {
        Ok(guard) => guard.clone(),
        Err(_) => StartupMigrationReport::default(),
    }
}

fn normalize_sync_provider_identifier(provider: &str) -> Result<String, String> {
    let normalized_provider = provider.trim();
    if normalized_provider.is_empty() {
        return Err("provider is required".to_string());
    }

    Ok(normalized_provider.to_string())
}

fn build_secure_store_self_test_result(
    backend: &str,
    available: bool,
    write_ok: bool,
    read_ok: bool,
    delete_ok: bool,
    detail: Option<String>,
) -> SyncProviderSecureStoreSelfTestResult {
    SyncProviderSecureStoreSelfTestResult {
        runtime: "tauri".to_string(),
        backend: backend.to_string(),
        available,
        write_ok,
        read_ok,
        delete_ok,
        roundtrip_ok: available && write_ok && read_ok && delete_ok,
        detail,
    }
}

#[cfg(any(
    target_os = "macos",
    target_os = "windows",
    target_os = "linux",
    target_os = "ios"
))]
fn create_sync_provider_auth_entry(provider: &str) -> Result<Entry, String> {
    let normalized_provider = normalize_sync_provider_identifier(provider)?;
    let account = format!("sync-provider::{normalized_provider}");
    Entry::new(SYNC_PROVIDER_AUTH_SERVICE, &account)
        .map_err(|error| format!("create keyring entry failed: {error}"))
}

#[cfg(any(
    target_os = "macos",
    target_os = "windows",
    target_os = "linux",
    target_os = "ios"
))]
fn run_native_secure_store_self_test() -> SyncProviderSecureStoreSelfTestResult {
    let entry = match Entry::new(
        SYNC_PROVIDER_AUTH_SERVICE,
        SYNC_PROVIDER_AUTH_SELF_TEST_ACCOUNT,
    ) {
        Ok(value) => value,
        Err(error) => {
            return build_secure_store_self_test_result(
                "keyring",
                false,
                false,
                false,
                false,
                Some(format!("create keyring entry failed: {error}")),
            );
        }
    };

    let mut detail: Option<String> = None;
    let write_ok = match entry.set_password(SYNC_PROVIDER_AUTH_SELF_TEST_PAYLOAD) {
        Ok(()) => true,
        Err(error) => {
            detail = Some(format!("write failed: {error}"));
            false
        }
    };

    let read_ok = if write_ok {
        match entry.get_password() {
            Ok(password) => {
                if password == SYNC_PROVIDER_AUTH_SELF_TEST_PAYLOAD {
                    true
                } else {
                    detail = Some("read payload mismatch".to_string());
                    false
                }
            }
            Err(error) => {
                detail = Some(format!("read failed: {error}"));
                false
            }
        }
    } else {
        false
    };

    let delete_ok = match entry.delete_credential() {
        Ok(()) => true,
        Err(error) => {
            if detail.is_none() {
                detail = Some(format!("delete failed: {error}"));
            }
            false
        }
    };

    build_secure_store_self_test_result("keyring", true, write_ok, read_ok, delete_ok, detail)
}

#[cfg(target_os = "android")]
fn run_android_secure_store_call<T, F>(
    window: tauri::WebviewWindow,
    operation: F,
) -> Result<T, String>
where
    T: Send + 'static,
    F: FnOnce(&mut jni::JNIEnv<'_>, &jni::objects::JObject<'_>) -> Result<T, String>
        + Send
        + 'static,
{
    let (sender, receiver) = mpsc::channel::<Result<T, String>>();
    window
        .with_webview(move |webview| {
            webview.jni_handle().exec(move |env, activity, _webview| {
                let result = operation(env, activity);
                let _ = sender.send(result);
            });
        })
        .map_err(|error| format!("schedule android secure store call failed: {error}"))?;

    receiver
        .recv_timeout(Duration::from_millis(ANDROID_SECURE_STORE_TIMEOUT_MS))
        .map_err(|_| "android secure store call timed out".to_string())?
}

#[cfg(target_os = "android")]
fn find_android_secure_store_class<'a>(
    env: &mut jni::JNIEnv<'a>,
    activity: &jni::objects::JObject<'_>,
) -> Result<jni::objects::JClass<'a>, String> {
    let class_name = env
        .new_string(ANDROID_SYNC_PROVIDER_SECURE_STORE_CLASS)
        .map_err(|error| format!("create secure store class name failed: {error}"))?;
    let class_value = env
        .call_method(
            activity,
            "getAppClass",
            "(Ljava/lang/String;)Ljava/lang/Class;",
            &[(&class_name).into()],
        )
        .map_err(|error| format!("resolve secure store class failed: {error}"))?;
    let class_object = class_value
        .l()
        .map_err(|error| format!("resolve secure store class object failed: {error}"))?;
    Ok(jni::objects::JClass::from(class_object))
}

#[cfg(target_os = "android")]
fn read_auth_from_android_secure_store(
    env: &mut jni::JNIEnv<'_>,
    activity: &jni::objects::JObject<'_>,
    provider: &str,
) -> Result<Option<String>, String> {
    let class = find_android_secure_store_class(env, activity)?;
    let provider_value = env
        .new_string(provider)
        .map_err(|error| format!("create provider string failed: {error}"))?;
    let auth_value = env
        .call_static_method(
            class,
            "get",
            "(Landroid/app/Activity;Ljava/lang/String;)Ljava/lang/String;",
            &[activity.into(), (&provider_value).into()],
        )
        .map_err(|error| format!("android secure store get failed: {error}"))?;
    let auth_object = auth_value
        .l()
        .map_err(|error| format!("android secure store get payload failed: {error}"))?;
    let is_null = env
        .is_same_object(&auth_object, jni::objects::JObject::null())
        .map_err(|error| format!("android secure store null check failed: {error}"))?;
    if is_null {
        return Ok(None);
    }

    let auth_string = jni::objects::JString::from(auth_object);
    let auth_text: String = env
        .get_string(&auth_string)
        .map_err(|error| format!("android secure store decode failed: {error}"))?
        .into();
    let normalized = auth_text.trim().to_string();
    if normalized.is_empty() {
        Ok(None)
    } else {
        Ok(Some(normalized))
    }
}

#[cfg(target_os = "android")]
fn write_auth_to_android_secure_store(
    env: &mut jni::JNIEnv<'_>,
    activity: &jni::objects::JObject<'_>,
    provider: &str,
    auth: &str,
) -> Result<(), String> {
    let class = find_android_secure_store_class(env, activity)?;
    let provider_value = env
        .new_string(provider)
        .map_err(|error| format!("create provider string failed: {error}"))?;
    let auth_value = env
        .new_string(auth)
        .map_err(|error| format!("create auth string failed: {error}"))?;
    let result = env
        .call_static_method(
            class,
            "set",
            "(Landroid/app/Activity;Ljava/lang/String;Ljava/lang/String;)Z",
            &[activity.into(), (&provider_value).into(), (&auth_value).into()],
        )
        .map_err(|error| format!("android secure store set failed: {error}"))?;
    let stored = result
        .z()
        .map_err(|error| format!("android secure store set status failed: {error}"))?;
    if stored {
        Ok(())
    } else {
        Err("android secure store rejected auth write".to_string())
    }
}

#[cfg(target_os = "android")]
fn delete_auth_from_android_secure_store(
    env: &mut jni::JNIEnv<'_>,
    activity: &jni::objects::JObject<'_>,
    provider: &str,
) -> Result<(), String> {
    let class = find_android_secure_store_class(env, activity)?;
    let provider_value = env
        .new_string(provider)
        .map_err(|error| format!("create provider string failed: {error}"))?;
    let result = env
        .call_static_method(
            class,
            "delete",
            "(Landroid/app/Activity;Ljava/lang/String;)Z",
            &[activity.into(), (&provider_value).into()],
        )
        .map_err(|error| format!("android secure store delete failed: {error}"))?;
    let deleted = result
        .z()
        .map_err(|error| format!("android secure store delete status failed: {error}"))?;
    if deleted {
        Ok(())
    } else {
        Err("android secure store rejected delete".to_string())
    }
}

#[cfg(target_os = "android")]
fn run_android_secure_store_self_test(
    window: tauri::WebviewWindow,
) -> SyncProviderSecureStoreSelfTestResult {
    let provider = "__sync_provider_secure_store_self_test__".to_string();
    let payload = SYNC_PROVIDER_AUTH_SELF_TEST_PAYLOAD.to_string();
    let result = run_android_secure_store_call(window, move |env, activity| {
        let mut detail: Option<String> = None;

        let write_ok = match write_auth_to_android_secure_store(
            env,
            activity,
            &provider,
            &payload,
        ) {
            Ok(()) => true,
            Err(error) => {
                detail = Some(error);
                false
            }
        };

        let read_ok = if write_ok {
            match read_auth_from_android_secure_store(env, activity, &provider) {
                Ok(Some(value)) => {
                    if value == payload {
                        true
                    } else {
                        detail = Some("read payload mismatch".to_string());
                        false
                    }
                }
                Ok(None) => {
                    detail = Some("read payload missing".to_string());
                    false
                }
                Err(error) => {
                    detail = Some(error);
                    false
                }
            }
        } else {
            false
        };

        let delete_ok = match delete_auth_from_android_secure_store(env, activity, &provider) {
            Ok(()) => true,
            Err(error) => {
                if detail.is_none() {
                    detail = Some(error);
                }
                false
            }
        };

        Ok((write_ok, read_ok, delete_ok, detail))
    });

    match result {
        Ok((write_ok, read_ok, delete_ok, detail)) => build_secure_store_self_test_result(
            "android_encrypted_shared_prefs",
            true,
            write_ok,
            read_ok,
            delete_ok,
            detail,
        ),
        Err(error) => build_secure_store_self_test_result(
            "android_encrypted_shared_prefs",
            false,
            false,
            false,
            false,
            Some(error),
        ),
    }
}

#[tauri::command]
fn get_sync_provider_secure_auth(
    window: tauri::WebviewWindow,
    provider: String,
) -> Result<Option<String>, String> {
    #[cfg(any(
        target_os = "macos",
        target_os = "windows",
        target_os = "linux",
        target_os = "ios"
    ))]
    {
        let _ = window;
        let entry = create_sync_provider_auth_entry(&provider)?;
        match entry.get_password() {
            Ok(password) => {
                let normalized = password.trim().to_string();
                if normalized.is_empty() {
                    Ok(None)
                } else {
                    Ok(Some(normalized))
                }
            }
            Err(_) => Ok(None),
        }
    }
    #[cfg(target_os = "android")]
    {
        let normalized_provider = normalize_sync_provider_identifier(&provider)?;
        run_android_secure_store_call(window, move |env, activity| {
            read_auth_from_android_secure_store(env, activity, &normalized_provider)
        })
    }
    #[cfg(not(any(
        target_os = "macos",
        target_os = "windows",
        target_os = "linux",
        target_os = "ios",
        target_os = "android"
    )))]
    {
        let _ = window;
        let _ = provider;
        Ok(None)
    }
}

#[tauri::command]
fn set_sync_provider_secure_auth(
    window: tauri::WebviewWindow,
    provider: String,
    auth: String,
) -> Result<(), String> {
    #[cfg(any(
        target_os = "macos",
        target_os = "windows",
        target_os = "linux",
        target_os = "ios"
    ))]
    {
        let _ = window;
        let normalized_auth = auth.trim();
        if normalized_auth.is_empty() {
            return Err("auth payload is required".to_string());
        }
        let entry = create_sync_provider_auth_entry(&provider)?;
        entry
            .set_password(normalized_auth)
            .map_err(|error| format!("store secure auth failed: {error}"))?;
        Ok(())
    }
    #[cfg(target_os = "android")]
    {
        let normalized_provider = normalize_sync_provider_identifier(&provider)?;
        let normalized_auth = auth.trim().to_string();
        if normalized_auth.is_empty() {
            return Err("auth payload is required".to_string());
        }
        run_android_secure_store_call(window, move |env, activity| {
            write_auth_to_android_secure_store(
                env,
                activity,
                &normalized_provider,
                &normalized_auth,
            )
        })
    }
    #[cfg(not(any(
        target_os = "macos",
        target_os = "windows",
        target_os = "linux",
        target_os = "ios",
        target_os = "android"
    )))]
    {
        let _ = window;
        let _ = provider;
        let _ = auth;
        Ok(())
    }
}

#[tauri::command]
fn delete_sync_provider_secure_auth(
    window: tauri::WebviewWindow,
    provider: String,
) -> Result<(), String> {
    #[cfg(any(
        target_os = "macos",
        target_os = "windows",
        target_os = "linux",
        target_os = "ios"
    ))]
    {
        let _ = window;
        let entry = create_sync_provider_auth_entry(&provider)?;
        let _ = entry.delete_credential();
        Ok(())
    }
    #[cfg(target_os = "android")]
    {
        let normalized_provider = normalize_sync_provider_identifier(&provider)?;
        run_android_secure_store_call(window, move |env, activity| {
            delete_auth_from_android_secure_store(env, activity, &normalized_provider)
        })
    }
    #[cfg(not(any(
        target_os = "macos",
        target_os = "windows",
        target_os = "linux",
        target_os = "ios",
        target_os = "android"
    )))]
    {
        let _ = window;
        let _ = provider;
        Ok(())
    }
}

#[tauri::command]
fn run_sync_provider_secure_store_self_test(
    window: tauri::WebviewWindow,
) -> SyncProviderSecureStoreSelfTestResult {
    #[cfg(any(
        target_os = "macos",
        target_os = "windows",
        target_os = "linux",
        target_os = "ios"
    ))]
    {
        let _ = window;
        return run_native_secure_store_self_test();
    }
    #[cfg(target_os = "android")]
    {
        return run_android_secure_store_self_test(window);
    }
    #[cfg(not(any(
        target_os = "macos",
        target_os = "windows",
        target_os = "linux",
        target_os = "ios",
        target_os = "android"
    )))]
    {
        let _ = window;
        build_secure_store_self_test_result(
            "unsupported",
            false,
            false,
            false,
            false,
            Some("secure store self-test is not supported on this platform".to_string()),
        )
    }
}

fn derive_legacy_app_data_dir(new_app_data_dir: &Path) -> Option<PathBuf> {
    let new_path = new_app_data_dir.to_string_lossy();
    if new_path.contains(CURRENT_BUNDLE_IDENTIFIER) {
        return Some(PathBuf::from(
            new_path.replacen(CURRENT_BUNDLE_IDENTIFIER, LEGACY_BUNDLE_IDENTIFIER, 1),
        ));
    }

    let file_name = new_app_data_dir.file_name()?.to_string_lossy();
    if file_name == CURRENT_BUNDLE_IDENTIFIER {
        return Some(new_app_data_dir.parent()?.join(LEGACY_BUNDLE_IDENTIFIER));
    }

    None
}

fn copy_optional_db_sidecar(source_db_path: &Path, destination_db_path: &Path, suffix: &str) -> Result<(), String> {
    let source_path = PathBuf::from(format!("{}{}", source_db_path.to_string_lossy(), suffix));
    if !source_path.exists() {
        return Ok(());
    }

    let destination_path = PathBuf::from(format!(
        "{}{}",
        destination_db_path.to_string_lossy(),
        suffix
    ));
    fs::copy(&source_path, &destination_path)
        .map(|_| ())
        .map_err(|error| format!("copy sidecar {suffix} failed: {error}"))
}

fn verify_database_copy(source_path: &Path, destination_path: &Path) -> Result<(), String> {
    let source_metadata =
        fs::metadata(source_path).map_err(|error| format!("read source metadata failed: {error}"))?;
    let destination_metadata = fs::metadata(destination_path)
        .map_err(|error| format!("read destination metadata failed: {error}"))?;
    if source_metadata.len() != destination_metadata.len() {
        return Err("copied database size mismatch".to_string());
    }
    Ok(())
}

fn run_startup_legacy_db_migration<R: tauri::Runtime>(
    app: &tauri::App<R>,
) -> StartupMigrationReport {
    let mut report = StartupMigrationReport::default();

    let new_app_data_dir = match app.path().app_data_dir() {
        Ok(path) => path,
        Err(error) => {
            report.migration_error = Some(format!("resolve app data dir failed: {error}"));
            return report;
        }
    };
    if let Err(error) = fs::create_dir_all(&new_app_data_dir) {
        report.migration_error = Some(format!("create app data dir failed: {error}"));
        return report;
    }

    let new_db_path = new_app_data_dir.join(DATABASE_FILENAME);
    report.new_db_path = Some(new_db_path.to_string_lossy().to_string());

    let marker_path = new_app_data_dir.join(STARTUP_MIGRATION_MARKER_FILENAME);
    report.marker_present = marker_path.exists();

    let legacy_app_data_dir = match derive_legacy_app_data_dir(&new_app_data_dir) {
        Some(path) => path,
        None => return report,
    };
    let legacy_db_path = legacy_app_data_dir.join(DATABASE_FILENAME);
    report.legacy_db_path = Some(legacy_db_path.to_string_lossy().to_string());
    report.legacy_path_detected = legacy_db_path.exists();

    if !report.legacy_path_detected {
        return report;
    }

    if report.marker_present || new_db_path.exists() {
        report.migration_completed = true;
        return report;
    }

    report.migration_attempted = true;
    if let Err(error) = fs::copy(&legacy_db_path, &new_db_path) {
        report.migration_error = Some(format!("copy legacy database failed: {error}"));
        return report;
    }

    for sidecar_suffix in ["-wal", "-shm"] {
        if let Err(error) = copy_optional_db_sidecar(&legacy_db_path, &new_db_path, sidecar_suffix)
        {
            report.migration_error = Some(error);
            return report;
        }
    }

    if let Err(error) = verify_database_copy(&legacy_db_path, &new_db_path) {
        report.migration_error = Some(error);
        return report;
    }

    let marker_payload = StartupMigrationMarkerPayload {
        version: 1,
        source_db_path: legacy_db_path.to_string_lossy().to_string(),
        destination_db_path: new_db_path.to_string_lossy().to_string(),
    };
    let marker_text = serde_json::to_string_pretty(&marker_payload)
        .unwrap_or_else(|_| "{\"version\":1}".to_string());
    if let Err(error) = fs::write(&marker_path, marker_text) {
        report.migration_error = Some(format!("write migration marker failed: {error}"));
        return report;
    }

    report.marker_present = true;
    report.migration_completed = true;
    report
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_sql::Builder::default().build())
        .setup(|app| {
            let startup_migration_report = run_startup_legacy_db_migration(app);
            if let Some(error) = startup_migration_report.migration_error.as_ref() {
                eprintln!("Startup migration warning: {error}");
            }
            app.manage(StartupMigrationState(Mutex::new(startup_migration_report)));

            #[cfg(not(any(target_os = "android", target_os = "ios")))]
            {
                let shortcut = if cfg!(target_os = "macos") {
                    "cmd+shift+n"
                } else {
                    "ctrl+shift+n"
                };

                let shortcut_plugin = tauri_plugin_global_shortcut::Builder::new()
                    .with_shortcuts([shortcut])
                    .map(|builder| {
                        builder
                            .with_handler(|app, _shortcut, event| {
                                if event.state == ShortcutState::Pressed {
                                    if let Some(main_window) = app.get_webview_window("main") {
                                        let _ = main_window.show();
                                        let _ = main_window.unminimize();
                                        let _ = main_window.set_focus();
                                    }
                                    let _ = app.emit(QUICK_CAPTURE_EVENT, ());
                                }
                            })
                            .build()
                    });

                match shortcut_plugin {
                    Ok(plugin) => {
                        if let Err(error) = app.handle().plugin(plugin) {
                            eprintln!("Unable to enable global shortcut plugin: {error}");
                        }
                    }
                    Err(error) => {
                        eprintln!("Unable to register global shortcut ({shortcut}): {error}");
                    }
                }
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_startup_migration_report,
            get_sync_provider_secure_auth,
            set_sync_provider_secure_auth,
            delete_sync_provider_secure_auth,
            run_sync_provider_secure_store_self_test
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
