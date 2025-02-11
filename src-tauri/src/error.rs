use serde::Serialize;

#[derive(Debug, thiserror::Error)]
pub enum Error {
    #[error(transparent)]
    Diff(#[from] wiztree_diff::Error),
    #[error("No diff value in app state, please invoke `diff` command first")]
    NoDiffValue,
    #[error("Failed to lock Mutex: {0}")]
    Lock(String),
    #[error(transparent)]
    Tauri(#[from] tauri::Error),
    #[error(transparent)]
    Io(#[from] std::io::Error),
    #[error("{executable} exit status: {status}")]
    ExitStatus {
        executable: String,
        status: i32,
    },
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase", tag = "kind", content = "message")]
pub enum ErrorKind {
    Diff(String),
    Lock(String),
    Tauri(String),
    NoDiffValue(String),
    Io(String),
    ExitStatus(String),
}

impl Error {
    pub fn kind(&self) -> ErrorKind {
        let e_string = self.to_string();
        match &self {
            Error::Diff(_) => ErrorKind::Diff(e_string),
            Error::Lock(_) => ErrorKind::Lock(e_string),
            Error::Tauri(_) => ErrorKind::Tauri(e_string),
            Error::NoDiffValue => ErrorKind::NoDiffValue(e_string),
            Error::Io(_) => ErrorKind::Io(e_string),
            Error::ExitStatus {..} => ErrorKind::ExitStatus(e_string),
        }
    }
}

impl Serialize for Error {
    fn serialize<S: serde::Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        self.kind().serialize(serializer)
    }
}