// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/

mod commands;
mod error;

use commands::{get_app_version, DiffState, diff, create_diff_window, destroy_diff_window, get_diff_nodes, get_diff_root_nodes};
use std::sync::Mutex;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            get_app_version,
            diff,
            create_diff_window,
            destroy_diff_window,
            get_diff_nodes,
            get_diff_root_nodes
        ])
        .setup(|app| {
            app.manage(Mutex::new(DiffState::new()));
            #[cfg(debug_assertions)]
            {
                let webview_window = app
                    .get_webview_window("main")
                    .ok_or("webview window `main` not found")?;
                webview_window.open_devtools();
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
