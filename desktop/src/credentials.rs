use std::sync::Mutex;
use tauri::Emitter;

// Serialize all native operations, including temporary process-wide macOS UI suppression.
static CREDENTIAL_ACCESS: Mutex<Option<CredentialErrorCode>> = Mutex::new(None);

#[cfg(not(feature = "native-test"))]
use keyring::{Entry, Error as KeyringError};
use serde::{Deserialize, Serialize};

#[cfg(not(feature = "native-test"))]
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
    fn exists(&self, account: &str) -> Result<bool, BackendError> {
        self.read(account).map(|value| value.is_some())
    }
    fn read(&self, account: &str) -> Result<Option<String>, BackendError>;
    fn write(&self, account: &str, value: &str) -> Result<(), BackendError>;
    fn remove(&self, account: &str) -> Result<(), BackendError>;
}

struct NativeCredentialBackend;

#[cfg(not(feature = "native-test"))]
impl NativeCredentialBackend {
    fn entry(account: &str) -> Result<Entry, BackendError> {
        Entry::new(CREDENTIAL_SERVICE, account).map_err(map_keyring_error)
    }
}

#[cfg(not(feature = "native-test"))]
impl CredentialBackend for NativeCredentialBackend {
    #[cfg(target_os = "macos")]
    fn exists(&self, account: &str) -> Result<bool, BackendError> {
        use security_framework::item::{ItemClass, ItemSearchOptions};
        match ItemSearchOptions::new()
            .class(ItemClass::generic_password())
            .service(CREDENTIAL_SERVICE)
            .account(account)
            .load_attributes(true)
            .load_data(false)
            .search()
        {
            Ok(items) => Ok(!items.is_empty()),
            Err(error) if error.code() == -25300 => Ok(false),
            Err(_) => Err(BackendError::Locked),
        }
    }
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

#[cfg(not(feature = "native-test"))]
fn map_keyring_error(error: KeyringError) -> BackendError {
    match error {
        KeyringError::NoStorageAccess(_) => BackendError::Locked,
        KeyringError::NoDefaultStore
        | KeyringError::NotSupportedByStore(_)
        | KeyringError::PlatformFailure(_) => BackendError::Unavailable,
        _ => BackendError::Failed,
    }
}

#[cfg(feature = "native-test")]
static TEST_CREDENTIALS: std::sync::LazyLock<Mutex<std::collections::HashMap<String, String>>> =
    std::sync::LazyLock::new(|| Mutex::new(std::collections::HashMap::new()));

#[cfg(feature = "native-test")]
impl CredentialBackend for NativeCredentialBackend {
    fn read(&self, account: &str) -> Result<Option<String>, BackendError> {
        Ok(TEST_CREDENTIALS
            .lock()
            .map_err(|_| BackendError::Failed)?
            .get(account)
            .cloned())
    }
    fn write(&self, account: &str, value: &str) -> Result<(), BackendError> {
        // Reserved fixture value in the memory-only native-test backend.
        if value == "open-pencil-native-test-denied" {
            return Err(BackendError::Locked);
        }
        TEST_CREDENTIALS
            .lock()
            .map_err(|_| BackendError::Failed)?
            .insert(account.to_owned(), value.to_owned());
        Ok(())
    }
    fn remove(&self, account: &str) -> Result<(), BackendError> {
        TEST_CREDENTIALS
            .lock()
            .map_err(|_| BackendError::Failed)?
            .remove(account);
        Ok(())
    }
}

fn access_state() -> std::sync::MutexGuard<'static, Option<CredentialErrorCode>> {
    CREDENTIAL_ACCESS.lock().unwrap_or_else(|error| {
        let mut state = error.into_inner();
        // A backend panic may interrupt bookkeeping; require explicit retry.
        state.get_or_insert(CredentialErrorCode::Failed);
        CREDENTIAL_ACCESS.clear_poison();
        state
    })
}

fn reset_access_state() {
    *access_state() = None;
}

fn credential_operation<T>(
    interactive: bool,
    operation: impl FnOnce() -> Result<T, CredentialError>,
) -> Result<T, CredentialError> {
    let mut denied = access_state();
    if interactive {
        if let Some(code) = *denied {
            return Err(CredentialError {
                code,
                message: "Credential access is paused; retry explicitly from Settings",
            });
        }
    }
    #[cfg(all(target_os = "macos", not(feature = "native-test")))]
    let _interaction = if !interactive {
        Some(
            security_framework::os::macos::keychain::SecKeychain::disable_user_interaction()
                .map_err(|_| public_error(BackendError::Unavailable))?,
        )
    } else {
        None
    };
    let result = operation();
    if interactive
        && result.as_ref().is_err_and(|error| {
            matches!(
                error.code,
                CredentialErrorCode::Locked
                    | CredentialErrorCode::Unavailable
                    | CredentialErrorCode::Failed
            )
        })
    {
        *denied = result.as_ref().err().map(|error| error.code);
    }
    result
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
pub async fn credential_access_paused() -> Result<bool, CredentialError> {
    tauri::async_runtime::spawn_blocking(|| Ok(access_state().is_some()))
        .await
        .map_err(|_| public_error(BackendError::Failed))?
}

#[tauri::command]
pub async fn credential_retry_access() -> Result<(), CredentialError> {
    tauri::async_runtime::spawn_blocking(|| {
        reset_access_state();
        Ok(())
    })
    .await
    .map_err(|_| public_error(BackendError::Failed))?
}

#[tauri::command]
pub async fn credential_store_availability() -> Result<CredentialStoreAvailability, CredentialError>
{
    tauri::async_runtime::spawn_blocking(|| {
        credential_operation(false, || {
            match NativeCredentialBackend.exists(AVAILABILITY_ACCOUNT) {
                Ok(_) => Ok(CredentialStoreAvailability::Available),
                Err(BackendError::Locked) => Ok(CredentialStoreAvailability::Locked),
                Err(BackendError::Unavailable) => Ok(CredentialStoreAvailability::Unavailable),
                Err(error) => Err(public_error(error)),
            }
        })
    })
    .await
    .map_err(|_| public_error(BackendError::Failed))?
}

#[tauri::command]
pub async fn credential_status(
    reference: CredentialRef,
) -> Result<CredentialStatus, CredentialError> {
    tauri::async_runtime::spawn_blocking(move || {
        match credential_operation(false, || {
            let account = account_for(&reference)?;
            NativeCredentialBackend
                .exists(&account)
                .map_err(public_error)
        }) {
            Ok(true) => Ok(CredentialStatus::Configured),
            Ok(false) => Ok(CredentialStatus::Missing),
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

async fn interactive_operation<T: Send + 'static>(
    app: tauri::AppHandle,
    operation: impl FnOnce() -> Result<T, CredentialError> + Send + 'static,
) -> Result<T, CredentialError> {
    let result =
        tauri::async_runtime::spawn_blocking(move || credential_operation(true, operation))
            .await
            .map_err(|_| public_error(BackendError::Failed))?;
    if let Err(error) = app.emit("credential-access-changed", ()) {
        eprintln!("Could not notify credential access change: {error}");
    }
    result
}

#[tauri::command]
pub async fn credential_read(
    app: tauri::AppHandle,
    reference: CredentialRef,
) -> Result<Option<String>, CredentialError> {
    interactive_operation(app, move || read_with(&NativeCredentialBackend, &reference)).await
}

#[tauri::command]
pub async fn credential_write(
    app: tauri::AppHandle,
    reference: CredentialRef,
    value: String,
) -> Result<(), CredentialError> {
    interactive_operation(app, move || {
        write_with(&NativeCredentialBackend, &reference, &value)
    })
    .await
}

#[tauri::command]
pub async fn credential_remove(
    app: tauri::AppHandle,
    reference: CredentialRef,
) -> Result<(), CredentialError> {
    interactive_operation(app, move || {
        remove_with(&NativeCredentialBackend, &reference)
    })
    .await
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

    fn reset_access() {
        reset_access_state();
    }

    static ACCESS_TEST_LOCK: Mutex<()> = Mutex::new(());

    #[test]
    fn backend_panic_pauses_access_and_explicit_retry_recovers() {
        let _guard = ACCESS_TEST_LOCK.lock().unwrap();
        reset_access();
        let panic = std::panic::catch_unwind(|| {
            let _: Result<(), CredentialError> =
                credential_operation(true, || panic!("test backend panic"));
        });
        assert!(panic.is_err());
        assert!(CREDENTIAL_ACCESS.is_poisoned());
        assert!(access_state().is_some());
        assert!(!CREDENTIAL_ACCESS.is_poisoned());
        let called = std::cell::Cell::new(false);
        assert!(credential_operation(true, || {
            called.set(true);
            Ok(())
        })
        .is_err());
        assert!(!called.get());
        assert!(credential_operation(false, || Ok(())).is_ok());
        reset_access_state();
        assert!(credential_operation(true, || Ok(())).is_ok());
    }

    #[test]
    fn concurrent_calls_do_not_repeat_an_interactive_failure() {
        let _guard = ACCESS_TEST_LOCK.lock().unwrap();
        reset_access();
        let calls = std::sync::atomic::AtomicUsize::new(0);
        std::thread::scope(|scope| {
            for _ in 0..8 {
                scope.spawn(|| {
                    let _: Result<(), CredentialError> = credential_operation(true, || {
                        calls.fetch_add(1, std::sync::atomic::Ordering::SeqCst);
                        Err(public_error(BackendError::Locked))
                    });
                });
            }
        });
        assert_eq!(calls.load(std::sync::atomic::Ordering::SeqCst), 1);
        assert!(credential_operation(false, || Ok(())).is_ok());
        reset_access();
    }

    #[test]
    fn denied_access_blocks_queued_operations_until_explicit_retry() {
        let _guard = ACCESS_TEST_LOCK.lock().unwrap();
        reset_access();
        let failure: Result<(), CredentialError> =
            credential_operation(true, || Err(public_error(BackendError::Locked)));
        assert!(failure.is_err());
        let called = std::cell::Cell::new(false);
        let blocked = credential_operation(true, || {
            called.set(true);
            Ok(())
        });
        assert!(blocked.is_err());
        assert!(!called.get());
        reset_access();
        assert!(credential_operation(true, || Ok(())).is_ok());
    }

    #[cfg(feature = "native-test")]
    #[test]
    fn native_test_credentials_are_process_memory_only() {
        let backend = NativeCredentialBackend;
        backend.write("test-memory", "disposable").unwrap();
        assert_eq!(
            backend.read("test-memory").unwrap(),
            Some("disposable".to_owned())
        );
        backend.remove("test-memory").unwrap();
        assert_eq!(backend.read("test-memory").unwrap(), None);
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
