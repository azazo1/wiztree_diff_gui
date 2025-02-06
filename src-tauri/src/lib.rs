// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/

// #[tauri::command]
// fn diff_snapshots() {
//     println!("Choose {} snapshot: {}", is_newer, csv_path.to_string_lossy());
// }

use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![])
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
