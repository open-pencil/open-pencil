//! The Swift library in `swift/sf-symbols`, which reads the symbols macOS has and draws them with
//! SwiftUI. Requests and answers are JSON in `SRString`s.

use swift_rs::{swift, SRString};

swift!(fn op_sf_symbols_catalogue() -> Option<SRString>);
swift!(fn op_sf_symbols_render(request: &SRString) -> Option<SRString>);

pub fn catalogue() -> Option<String> {
    // SAFETY: the catalogue takes no arguments and may run on any thread.
    unsafe { op_sf_symbols_catalogue() }.map(|answer| answer.to_string())
}

/// Must run on the main thread.
pub fn render(request: &str) -> Option<String> {
    let request = SRString::from(request);
    // SAFETY: the request is a Swift string that outlives the call.
    unsafe { op_sf_symbols_render(&request) }.map(|answer| answer.to_string())
}
