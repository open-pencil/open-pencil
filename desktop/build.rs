fn main() {
    println!("cargo:rerun-if-env-changed=OPENPENCIL_CREDENTIAL_SERVICE");
    let service = std::env::var("OPENPENCIL_CREDENTIAL_SERVICE")
        .unwrap_or_else(|_| "net.dannote.open-pencil.credentials".to_string());
    println!("cargo:rustc-env=OPENPENCIL_CREDENTIAL_SERVICE={service}");
    tauri_build::build()
}
