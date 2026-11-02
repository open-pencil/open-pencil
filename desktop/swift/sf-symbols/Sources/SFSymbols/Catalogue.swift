import Foundation

/// The symbols this Mac draws, from the metadata macOS keeps beside its own symbol images.
struct Catalogue: Encodable {
  /// Every name, in the order Apple lists them.
  var names: [String]
  /// Search keywords by name, for the names that have them.
  var keywords: [String: [String]]
}

private let metadata = URL(
  fileURLWithPath: "/System/Library/CoreServices/CoreGlyphs.bundle/Contents/Resources")

private func plist(_ name: String) -> Any? {
  guard let data = try? Data(contentsOf: metadata.appendingPathComponent("\(name).plist")) else {
    return nil
  }
  return try? PropertyListSerialization.propertyList(from: data, format: nil)
}

private func version(_ text: String) -> OperatingSystemVersion {
  let parts = text.split(separator: ".").map { Int($0) ?? 0 }
  return OperatingSystemVersion(
    majorVersion: parts.first ?? 0,
    minorVersion: parts.count > 1 ? parts[1] : 0,
    patchVersion: parts.count > 2 ? parts[2] : 0)
}

/// The catalogue, or nil when macOS keeps no symbol metadata where it is read from.
func catalogue() -> Catalogue? {
  guard
    let order = plist("symbol_order") as? [String],
    let availability = plist("name_availability") as? [String: Any],
    let released = availability["symbols"] as? [String: String],
    let releases = availability["year_to_release"] as? [String: [String: String]]
  else { return nil }
  let running = ProcessInfo.processInfo
  // A symbol is drawn from the macOS release its year shipped in.
  let names = order.filter { name in
    guard let year = released[name], let macOS = releases[year]?["macOS"] else { return false }
    return running.isOperatingSystemAtLeast(version(macOS))
  }
  let keywords = (plist("symbol_search") as? [String: [String]]) ?? [:]
  return Catalogue(names: names, keywords: keywords.filter { released[$0.key] != nil })
}
