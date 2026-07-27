use keyring::{Entry, Error as KeyringError};
use serde::{Deserialize, Serialize};

const CREDENTIAL_SERVICE: &str = "net.dannote.open-pencil.credentials";
const AVAILABILITY_ACCOUNT: &str = "v1:system:default:availability";
const MAX_SEGMENT_LENGTH: usize = 64;
const MAX_CREDENTIAL_LENGTH: usize = 16 * 1024;

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CredentialRef {
    integration_id: String,
    profile_id: String,
    field: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CredentialError {
    code: CredentialErrorCode,
    message: &'static str,
}

#[derive(Clone, Copy, Debug, Serialize)]
#[serde(rename_all = "kebab-case")]
enum CredentialErrorCode {
    InvalidReference,
    InvalidValue,
    Locked,
    Unavailable,
    Failed,
}

#[derive(Clone, Copy, Debug, PartialEq, Serialize)]
#[serde(rename_all = "kebab-case")]
pub enum CredentialStatus {
    Configured,
    Missing,
    Locked,
    Unavailable,
}

#[derive(Clone, Copy, Debug, PartialEq, Serialize)]
#[serde(rename_all = "kebab-case")]
pub enum CredentialStoreAvailability {
    Available,
    Locked,
    Unavailable,
}

#[derive(Clone, Copy, Debug, PartialEq)]
enum BackendError {
    Locked,
    Unavailable,
    Failed,
}

trait CredentialBackend {
    fn read(&self, account: &str) -> Result<Option<String>, BackendError>;
    fn write(&self, account: &str, value: &str) -> Result<(), BackendError>;
    fn remove(&self, account: &str) -> Result<(), BackendError>;
}

struct NativeCredentialBackend;

impl NativeCredentialBackend {
    fn entry(account: &str) -> Result<Entry, BackendError> {
        Entry::new(CREDENTIAL_SERVICE, account).map_err(map_keyring_error)
    }
}

impl CredentialBackend for NativeCredentialBackend {
    fn read(&self, account: &str) -> Result<Option<String>, BackendError> {
        match Self::entry(account)?.get_password() {
            Ok(value) => Ok(Some(value)),
            Err(KeyringError::NoEntry) => Ok(None),
            Err(error) => Err(map_keyring_error(error)),
        }
    }

    fn write(&self, account: &str, value: &str) -> Result<(), BackendError> {
        Self::entry(account)?
            .set_password(value)
            .map_err(map_keyring_error)
    }

    fn remove(&self, account: &str) -> Result<(), BackendError> {
        match Self::entry(account)?.delete_credential() {
            Ok(()) | Err(KeyringError::NoEntry) => Ok(()),
            Err(error) => Err(map_keyring_error(error)),
        }
    }
}

fn map_keyring_error(error: KeyringError) -> BackendError {
    match error {
        KeyringError::NoStorageAccess(_) => BackendError::Locked,
        KeyringError::NoDefaultStore
        | KeyringError::NotSupportedByStore(_)
        | KeyringError::PlatformFailure(_) => BackendError::Unavailable,
        _ => BackendError::Failed,
    }
}

fn validate_segment(value: &str) -> bool {
    !value.is_empty()
        && value.len() <= MAX_SEGMENT_LENGTH
        && value.bytes().all(|byte| {
            byte.is_ascii_lowercase() || byte.is_ascii_digit() || matches!(byte, b'.' | b'_' | b'-')
        })
}

fn account_for(reference: &CredentialRef) -> Result<String, CredentialError> {
    if !validate_segment(&reference.integration_id)
        || !validate_segment(&reference.profile_id)
        || !validate_segment(&reference.field)
    {
        return Err(CredentialError {
            code: CredentialErrorCode::InvalidReference,
            message: "Credential reference is invalid",
        });
    }

    Ok(format!(
        "v1:{}:{}:{}",
        reference.integration_id, reference.profile_id, reference.field
    ))
}

fn public_error(error: BackendError) -> CredentialError {
    match error {
        BackendError::Locked => CredentialError {
            code: CredentialErrorCode::Locked,
            message: "The system credential store is locked",
        },
        BackendError::Unavailable => CredentialError {
            code: CredentialErrorCode::Unavailable,
            message: "The system credential store is unavailable",
        },
        BackendError::Failed => CredentialError {
            code: CredentialErrorCode::Failed,
            message: "The credential operation failed",
        },
    }
}

fn read_with(
    backend: &impl CredentialBackend,
    reference: &CredentialRef,
) -> Result<Option<String>, CredentialError> {
    let account = account_for(reference)?;
    backend.read(&account).map_err(public_error)
}

fn write_with(
    backend: &impl CredentialBackend,
    reference: &CredentialRef,
    value: &str,
) -> Result<(), CredentialError> {
    if value.is_empty() || value.len() > MAX_CREDENTIAL_LENGTH {
        return Err(CredentialError {
            code: CredentialErrorCode::InvalidValue,
            message: "Credential value is invalid",
        });
    }
    let account = account_for(reference)?;
    backend.write(&account, value).map_err(public_error)
}

fn remove_with(
    backend: &impl CredentialBackend,
    reference: &CredentialRef,
) -> Result<(), CredentialError> {
    let account = account_for(reference)?;
    backend.remove(&account).map_err(public_error)
}

#[tauri::command]
pub async fn credential_store_availability() -> Result<CredentialStoreAvailability, CredentialError>
{
    tauri::async_runtime::spawn_blocking(|| {
        match NativeCredentialBackend.read(AVAILABILITY_ACCOUNT) {
            Ok(_) => Ok(CredentialStoreAvailability::Available),
            Err(BackendError::Locked) => Ok(CredentialStoreAvailability::Locked),
            Err(BackendError::Unavailable) => Ok(CredentialStoreAvailability::Unavailable),
            Err(error) => Err(public_error(error)),
        }
    })
    .await
    .map_err(|_| public_error(BackendError::Failed))?
}

#[tauri::command]
pub async fn credential_status(
    reference: CredentialRef,
) -> Result<CredentialStatus, CredentialError> {
    tauri::async_runtime::spawn_blocking(move || {
        match read_with(&NativeCredentialBackend, &reference) {
            Ok(Some(_)) => Ok(CredentialStatus::Configured),
            Ok(None) => Ok(CredentialStatus::Missing),
            Err(CredentialError {
                code: CredentialErrorCode::Locked,
                ..
            }) => Ok(CredentialStatus::Locked),
            Err(CredentialError {
                code: CredentialErrorCode::Unavailable,
                ..
            }) => Ok(CredentialStatus::Unavailable),
            Err(error) => Err(error),
        }
    })
    .await
    .map_err(|_| public_error(BackendError::Failed))?
}

#[tauri::command]
pub async fn credential_read(reference: CredentialRef) -> Result<Option<String>, CredentialError> {
    tauri::async_runtime::spawn_blocking(move || read_with(&NativeCredentialBackend, &reference))
        .await
        .map_err(|_| public_error(BackendError::Failed))?
}

#[tauri::command]
pub async fn credential_write(
    reference: CredentialRef,
    value: String,
) -> Result<(), CredentialError> {
    tauri::async_runtime::spawn_blocking(move || {
        write_with(&NativeCredentialBackend, &reference, &value)
    })
    .await
    .map_err(|_| public_error(BackendError::Failed))?
}

#[tauri::command]
pub async fn credential_remove(reference: CredentialRef) -> Result<(), CredentialError> {
    tauri::async_runtime::spawn_blocking(move || remove_with(&NativeCredentialBackend, &reference))
        .await
        .map_err(|_| public_error(BackendError::Failed))?
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::{collections::HashMap, sync::Mutex};

    #[derive(Default)]
    struct MemoryBackend(Mutex<HashMap<String, String>>);

    impl CredentialBackend for MemoryBackend {
        fn read(&self, account: &str) -> Result<Option<String>, BackendError> {
            Ok(self
                .0
                .lock()
                .ok()
                .and_then(|values| values.get(account).cloned()))
        }

        fn write(&self, account: &str, value: &str) -> Result<(), BackendError> {
            self.0
                .lock()
                .map_err(|_| BackendError::Failed)?
                .insert(account.to_owned(), value.to_owned());
            Ok(())
        }

        fn remove(&self, account: &str) -> Result<(), BackendError> {
            self.0
                .lock()
                .map_err(|_| BackendError::Failed)?
                .remove(account);
            Ok(())
        }
    }

    fn reference() -> CredentialRef {
        CredentialRef {
            integration_id: "openai-compatible".to_owned(),
            profile_id: "default".to_owned(),
            field: "api-key".to_owned(),
        }
    }

    #[test]
    fn creates_stable_versioned_account_names() {
        assert_eq!(
            account_for(&reference()).expect("valid reference"),
            "v1:openai-compatible:default:api-key"
        );
    }

    #[test]
    fn rejects_untrusted_account_segments() {
        let invalid = CredentialRef {
            integration_id: "../../other-app".to_owned(),
            ..reference()
        };

        assert!(account_for(&invalid).is_err());
    }

    #[test]
    fn rejects_empty_credential_values() {
        let backend = MemoryBackend::default();
        assert!(write_with(&backend, &reference(), "").is_err());
    }

    #[test]
    fn reads_writes_and_removes_through_backend_contract() {
        let backend = MemoryBackend::default();
        let reference = reference();

        assert_eq!(read_with(&backend, &reference).expect("initial read"), None);
        write_with(&backend, &reference, "secret").expect("write");
        assert_eq!(
            read_with(&backend, &reference).expect("configured read"),
            Some("secret".to_owned())
        );
        remove_with(&backend, &reference).expect("remove");
        assert_eq!(read_with(&backend, &reference).expect("removed read"), None);
    }
}
