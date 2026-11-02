fn main() {
    // SF Symbols are drawn by SwiftUI, through a Swift library linked into the macOS app.
    #[cfg(target_os = "macos")]
    if std::env::var("CARGO_CFG_TARGET_OS").as_deref() == Ok("macos") {
        swift_rs::SwiftLinker::new("13.0")
            .with_package("SFSymbols", "swift/sf-symbols")
            .link();
        // The Swift runtime the library uses ships with macOS.
        println!("cargo:rustc-link-arg=-Wl,-rpath,/usr/lib/swift");
    }
    tauri_build::build()
}
