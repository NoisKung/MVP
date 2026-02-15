mod db;

#[cfg(not(any(target_os = "android", target_os = "ios")))]
use tauri::{Emitter, Manager};
#[cfg(not(any(target_os = "android", target_os = "ios")))]
use tauri_plugin_global_shortcut::ShortcutState;

#[cfg(not(any(target_os = "android", target_os = "ios")))]
const QUICK_CAPTURE_EVENT: &str = "quick-capture:open";

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_sql::Builder::default().build())
        .setup(|app| {
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
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
