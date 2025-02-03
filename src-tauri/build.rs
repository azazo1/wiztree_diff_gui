fn main() {
    tauri_build::build();

    // compile tsc
    let status = std::process::Command::new(if cfg!(windows) { "tsc.cmd" } else { "tsc" })
        .current_dir("../src")
        .status()
        .expect("failed to execute process");
    assert!(status.success());
}
