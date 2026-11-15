// swift-tools-version:5.9
import PackageDescription

let package = Package(
  name: "SFSymbols",
  platforms: [.macOS(.v13)],
  products: [.library(name: "SFSymbols", type: .static, targets: ["SFSymbols"])],
  // The Swift half of the `swift-rs` crate, at the version `desktop/Cargo.toml` pins.
  dependencies: [.package(url: "https://github.com/Brendonovich/swift-rs", exact: "1.0.9")],
  targets: [
    .target(name: "SFSymbols", dependencies: [.product(name: "SwiftRs", package: "swift-rs")])
  ]
)
