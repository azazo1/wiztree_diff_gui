use crate::error::Error;
use serde::Serialize;
use std::ops::{Deref, DerefMut};
use std::path::PathBuf;
use std::sync::Mutex;
use std::time::Duration;
use tauri::ipc::Channel;
use tauri::{AppHandle, Manager, State, WebviewUrl, WebviewWindowBuilder};
use wiztree_diff::{Builder, Diff, Message, ReportProcessingInterval, ReportReadingInterval};

pub(crate) struct DiffState {
    diff: Option<Diff>,
}

impl DiffState {
    pub(crate) fn new() -> Self {
        Self {
            diff: None,
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
    let mut diff_state = diff_state.lock().map_err(|_| Error::Lock("diff_state".to_owned()))?;
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
    Ok(())
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
    win.show()?;
    Ok(())
}

#[tauri::command]
pub fn destroy_diff_window(app: AppHandle) -> Result<(), Error> {
    app.get_webview_window("diff")
        .map(|w| w.destroy())
        .unwrap_or(Ok(()))?;
    Ok(())
}