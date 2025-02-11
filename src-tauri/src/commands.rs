use crate::error::Error;
use serde::Serialize;
use std::ops::{Deref, DerefMut};
use std::path::PathBuf;
use std::sync::Mutex;
use std::time::Duration;
use tauri::ipc::Channel;
use tauri::{AppHandle, LogicalSize, Manager, State, WebviewUrl, WebviewWindowBuilder};
use wiztree_diff::{Builder, Diff, DiffNode, Message, ReportProcessingInterval, ReportReadingInterval};

pub(crate) struct DiffState {
    diff: Option<Diff>,
    older_file: Option<String>,
    newer_file: Option<String>,
}

impl DiffState {
    pub(crate) fn new() -> Self {
        Self {
            diff: None,
            older_file: None,
            newer_file: None,
        }
    }
}

impl Deref for DiffState {
    type Target = Option<Diff>;

    fn deref(&self) -> &Self::Target {
        &self.diff
    }
}

impl DerefMut for DiffState {
    fn deref_mut(&mut self) -> &mut Self::Target {
        &mut self.diff
    }
}

#[tauri::command]
pub fn get_app_version(app: AppHandle) -> String {
    let mut v = app.package_info().version.to_string();
    if !v.starts_with('v') {
        v.insert(0, 'v');
    }
    v
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LoadingMsg {
    msg: Message,
    file: PathBuf,
    /// 先加载 older, 再加载 newer.
    is_newer: bool,
}

#[tauri::command]
pub async fn diff(
    app: AppHandle,
    channel: Channel<LoadingMsg>,
    older_file: String,
    newer_file: String,
) -> Result<(), Error> {
    let diff_state: State<Mutex<DiffState>> = app.state();
    let mut diff_state = diff_state.lock().map_err(|e| Error::Lock(e.to_string()))?;
    let r_interval = ReportReadingInterval::Time(Duration::from_millis(100));
    let p_interval = ReportProcessingInterval::Time(Duration::from_millis(100));
    let older_snapshot = Builder::new()
        .set_reading_report_interval(r_interval)
        .set_processing_report_interval(p_interval)
        .set_reporter(|msg| {
            let rst = channel.send(LoadingMsg {
                msg,
                file: older_file.clone().into(),
                is_newer: false,
            });
            if let Err(e) = rst {
                eprintln!("Error sending message: {:?}", e);
            }
        })
        .build_from_file(&older_file, true)?;
    let newer_snapshot = Builder::new()
        .set_reading_report_interval(r_interval)
        .set_processing_report_interval(p_interval)
        .set_reporter(|msg| {
            let rst = channel.send(LoadingMsg {
                msg,
                file: newer_file.clone().into(),
                is_newer: true,
            });
            if let Err(e) = rst {
                eprintln!("Error sending message: {:?}", e);
            }
        })
        .build_from_file(&newer_file, true)?;
    let diff = Diff::new(newer_snapshot, older_snapshot);
    diff_state.diff = Some(diff);
    diff_state.newer_file = Some(newer_file);
    diff_state.older_file = Some(older_file);
    Ok(())
}

#[tauri::command]
pub fn get_diffing_files(app: AppHandle) -> Result<(Option<String>, Option<String>), Error> {
    let diff_state: State<Mutex<DiffState>> = app.state();
    let diff_state = diff_state.lock().map_err(|e| Error::Lock(e.to_string()))?;
    Ok((diff_state.newer_file.clone(), diff_state.older_file.clone()))
}

#[tauri::command]
pub async fn create_diff_window(app: AppHandle) -> Result<(), Error> {
    // new 这个调用必须使用 async command: https://docs.rs/tauri/latest/tauri/webview/struct.WebviewWindowBuilder.html#implementations
    // 动态创建的窗口不用填到 tauri.conf.json 中
    let win = WebviewWindowBuilder::new(
        &app,
        "diff",
        WebviewUrl::App("diff.html".into()))
        .build()?;
    win.set_title("Diff Viewer")?;
    win.set_size(LogicalSize {
        width: 900,
        height: 500,
    }).unwrap_or_else(|e| {
        eprintln!("Error setting size: {:?}", e);
    });
    win.show()?;
    #[cfg(debug_assertions)]
    {
        win.open_devtools();
    }
    Ok(())
}

#[tauri::command]
pub fn destroy_diff_window(app: AppHandle) -> Result<(), Error> {
    app.get_webview_window("diff")
        .map(|w| w.destroy())
        .unwrap_or(Ok(()))?;
    Ok(())
}

#[tauri::command]
pub fn get_diff_nodes(path: String, app: AppHandle) -> Result<Vec<DiffNode>, Error> {
    let diff_state: State<Mutex<DiffState>> = app.state();
    let mut diff_state = diff_state.lock().map_err(|e| Error::Lock(e.to_string()))?;
    let diff = diff_state.as_mut().ok_or(Error::NoDiffValue)?;
    diff.view_path(path)?;
    Ok(diff.nodes().to_vec())
}

#[tauri::command]
pub fn get_diff_root_nodes(app: AppHandle) -> Result<Vec<DiffNode>, Error> {
    let diff_state: State<Mutex<DiffState>> = app.state();
    let mut diff_state = diff_state.lock().map_err(|e| Error::Lock(e.to_string()))?;
    let diff = diff_state.as_mut().ok_or(Error::NoDiffValue)?;
    diff.view_roots();
    Ok(diff.nodes().to_vec())
}

#[tauri::command]
pub fn open_in_explorer(path: &str) -> Result<(), Error> {
    // 检查路径是否存在
    std::fs::metadata(path)?;
    // 根据操作系统执行不同的命令
    let mut cmd = {
        if cfg!(target_os = "windows") {
            let mut cmd = std::process::Command::new("explorer.exe");
            cmd.arg("/select,").arg(path);
            cmd
        } else if cfg!(target_os = "macos") {
            let mut cmd = std::process::Command::new("open");
            cmd.arg(path);
            cmd
        } else if cfg!(target_os = "linux") {
            let mut cmd = std::process::Command::new("xdg-open");
            cmd.arg(path);
            cmd
        } else {
            Err(std::io::Error::new(
                std::io::ErrorKind::Other,
                "Unsupported platform",
            ))?
        }
    };
    let exit_status = cmd.status()?;
    if !exit_status.success() {
        Err(Error::ExitStatus {
            executable: cmd.get_args()
                .map(|a| a.to_string_lossy().to_string())
                .collect::<Vec<String>>()
                .join(" "),
            status: exit_status.code().unwrap_or(-1),
        })?
    }
    Ok(())
}