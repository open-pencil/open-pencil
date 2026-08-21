use crate::credentials::{CredentialRef, NativeTestCredentials};

#[tauri::command]
pub fn native_test_credential_read(
    state: tauri::State<NativeTestCredentials>,
    reference: CredentialRef,
) -> Result<Option<String>, String> {
    let account =
        super::credentials::validated_account(&reference).map_err(|error| error.message)?;
    state
        .0
        .lock()
        .map(|values| values.get(&account).cloned())
        .map_err(|_| "Native test credential state is unavailable".to_owned())
}

#[tauri::command]
pub fn native_test_credential_write(
    state: tauri::State<NativeTestCredentials>,
    reference: CredentialRef,
    value: String,
) -> Result<(), String> {
    if value.is_empty() {
        return Err("Credential value is invalid".to_owned());
    }
    let account =
        super::credentials::validated_account(&reference).map_err(|error| error.message)?;
    state
        .0
        .lock()
        .map(|mut values| {
            values.insert(account, value);
        })
        .map_err(|_| "Native test credential state is unavailable".to_owned())
}

#[tauri::command]
pub fn native_test_credential_remove(
    state: tauri::State<NativeTestCredentials>,
    reference: CredentialRef,
) -> Result<(), String> {
    let account =
        super::credentials::validated_account(&reference).map_err(|error| error.message)?;
    state
        .0
        .lock()
        .map(|mut values| {
            values.remove(&account);
        })
        .map_err(|_| "Native test credential state is unavailable".to_owned())
}
