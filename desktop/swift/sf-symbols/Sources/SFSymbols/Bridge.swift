import Foundation
import SwiftRs

/// The functions the desktop app calls. Requests and answers are JSON in `SRString`s.

private func json<T: Encodable>(_ value: T?) -> SRString? {
  guard let value, let data = try? JSONEncoder().encode(value) else { return nil }
  return SRString(String(decoding: data, as: UTF8.self))
}

/// The symbols this Mac draws, or nil when it cannot draw them as outlines.
@_cdecl("op_sf_symbols_catalogue")
public func opSFSymbolsCatalogue() -> SRString? {
  guard #available(macOS 14, *) else { return nil }
  return json(catalogue())
}

/// Each named symbol this Mac has, drawn as the request asks. Must run on the main thread.
@_cdecl("op_sf_symbols_render")
public func opSFSymbolsRender(_ request: SRString) -> SRString? {
  guard #available(macOS 14, *),
    let request = try? JSONDecoder().decode(RenderRequest.self, from: Data(request.toString().utf8))
  else { return nil }
  return MainActor.assumeIsolated {
    var icons: [String: Icon] = [:]
    for name in request.names {
      if let icon = icon(name, request) { icons[name] = icon }
    }
    return json(icons)
  }
}
