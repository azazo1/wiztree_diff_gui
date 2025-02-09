use serde::Serialize;

#[derive(Debug, thiserror::Error)]
pub enum Error {
    #[error(transparent)]
    Diff(#[from] wiztree_diff::Error),
    #[error("Failed to lock Mutex")]
    Lock(String),
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase", tag = "kind", content = "message")]
pub enum ErrorKind {
    Diff(String),
    Lock(String),
}

impl Error {
    pub fn kind(&self) -> ErrorKind {
        let e_string = self.to_string();
        match &self {
            Error::Diff(_) => ErrorKind::Diff(e_string),
            Error::Lock(_) => ErrorKind::Lock(e_string),
        }
    }
}

impl Serialize for Error {
    fn serialize<S: serde::Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        self.kind().serialize(serializer)
    }
}