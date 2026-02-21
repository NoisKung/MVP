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

#[cfg(not(any(target_os = "android", target_os = "ios")))]
const QUICK_CAPTURE_EVENT: &str = "quick-capture:open";
const CURRENT_BUNDLE_IDENTIFIER: &str = "com.solutionsstudio.solostack";
const LEGACY_BUNDLE_IDENTIFIER: &str = "com.antigravity.solostack";
const DATABASE_FILENAME: &str = "solostack.db";
const STARTUP_MIGRATION_MARKER_FILENAME: &str = "startup-migration-v1.json";

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
        .invoke_handler(tauri::generate_handler![get_startup_migration_report])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
