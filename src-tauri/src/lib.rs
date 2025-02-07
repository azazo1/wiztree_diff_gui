// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/

use tauri::{Manager, AppHandle};

#[tauri::command]
fn get_app_version(app: AppHandle) -> String {
    let mut v = app.package_info().version.to_string();
    if !v.starts_with('v') {
        v.insert(0, 'v');
    }
    v
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![get_app_version])
        .setup(|app| {
            let webview_window = app
                .get_webview_window("main")
                .ok_or("webview window `main` not found")?;
            #[cfg(debug_assertions)]
            webview_window.open_devtools();
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
