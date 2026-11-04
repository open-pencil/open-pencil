import AppKit
import SwiftUI

/// How a set of symbols is asked to be drawn.
struct RenderRequest: Decodable {
  var names: [String]
  var size: Double
  var weight: String
  var scale: String
  var rendering: String
}

struct IconPath: Encodable {
  var d: String
  var opacity: Double
}

/// A symbol fitted into the square of the size asked for, centred, as icons are.
struct Icon: Encodable {
  var paths: [IconPath]
}

private let weights: [String: Font.Weight] = [
  "ultralight": .ultraLight, "thin": .thin, "light": .light, "regular": .regular,
  "medium": .medium, "semibold": .semibold, "bold": .bold, "heavy": .heavy, "black": .black,
]

private let scales: [String: Image.Scale] = ["small": .small, "medium": .medium, "large": .large]

private func number(_ value: CGFloat) -> String {
  String(format: "%.3f", value).replacingOccurrences(
    of: "\\.?0+$", with: "", options: .regularExpression)
}

/// SVG path data for `path` mapped through `transform`.
private func pathData(_ path: CGPath, _ transform: CGAffineTransform) -> String {
  var data = ""
  func point(_ p: CGPoint) -> String {
    let mapped = p.applying(transform)
    return "\(number(mapped.x)) \(number(mapped.y))"
  }
  path.applyWithBlock { element in
    let points = element.pointee.points
    switch element.pointee.type {
    case .moveToPoint: data += "M\(point(points[0]))"
    case .addLineToPoint: data += "L\(point(points[0]))"
    case .addQuadCurveToPoint: data += "Q\(point(points[0])) \(point(points[1]))"
    case .addCurveToPoint: data += "C\(point(points[0])) \(point(points[1])) \(point(points[2]))"
    case .closeSubpath: data += "Z"
    @unknown default: break
    }
  }
  return data
}

/// The symbol's drawing as a one-page PDF, and the box SwiftUI lays it out in.
@MainActor
private func pdf(_ name: String, _ request: RenderRequest) -> (Data, CGSize)? {
  guard NSImage(systemSymbolName: name, accessibilityDescription: nil) != nil else { return nil }
  let image = Image(systemName: name)
    .font(.system(size: request.size, weight: weights[request.weight] ?? .regular))
    .imageScale(scales[request.scale] ?? .medium)
    .foregroundStyle(.black)
    .symbolRenderingMode(request.rendering == "hierarchical" ? .hierarchical : .monochrome)
  var result: (Data, CGSize)?
  ImageRenderer(content: image).render { size, draw in
    var box = CGRect(origin: .zero, size: size)
    let data = NSMutableData()
    guard let consumer = CGDataConsumer(data: data as CFMutableData),
      let context = CGContext(consumer: consumer, mediaBox: &box, nil)
    else { return }
    context.beginPDFPage(nil)
    draw(context)
    context.endPDFPage()
    context.closePDF()
    result = (data as Data, size)
  }
  return result
}

/// A symbol as an icon, or nil when this Mac has no symbol by that name or draws it in a way its
/// outlines cannot be read from, which is reported rather than drawn incomplete.
@available(macOS 14, *)
@MainActor
func icon(_ name: String, _ request: RenderRequest) -> Icon? {
  guard let (data, layout) = pdf(name, request) else { return nil }
  let drawn: [Outline]
  do {
    drawn = try outlines(ofPDF: data)
  } catch let unreadable as UnreadableDrawing {
    let operators = unreadable.operators.sorted().joined(separator: ", ")
    FileHandle.standardError.write(
      Data("SF Symbols: \(name) paints with \(operators), which outlines cannot read\n".utf8))
    return nil
  } catch {
    return nil
  }
  // Badges reach past the box SwiftUI lays a symbol out in, so the icon holds both.
  let bounds = drawn.reduce(CGRect(origin: .zero, size: layout)) {
    $0.union($1.path.boundingBoxOfPath)
  }
  let scale = request.size / max(bounds.width, bounds.height)
  // PDF pages run upward; icons run downward from their top left.
  let transform = CGAffineTransform(translationX: -bounds.midX, y: -bounds.midY)
    .concatenating(CGAffineTransform(scaleX: scale, y: -scale))
    .concatenating(CGAffineTransform(translationX: request.size / 2, y: request.size / 2))
  return Icon(
    paths: drawn.map { IconPath(d: pathData($0.path, transform), opacity: $0.opacity) })
}
