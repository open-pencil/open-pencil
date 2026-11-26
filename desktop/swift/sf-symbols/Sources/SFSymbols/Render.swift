import AppKit
import SwiftUI

/// How a set of symbols is asked to be drawn.
struct RenderRequest: Decodable {
  var names: [String]
  var size: Double
  var weight: String
  var scale: String
  /// monochrome, hierarchical, palette, or multicolor, as SwiftUI renders symbols.
  var rendering: String
  /// How much of a symbol with variable colour is on, from 0 to 1; nil draws all of it.
  var variable: Double?
}

struct IconPath: Encodable {
  var d: String
  var opacity: Double
  /// In palette rendering, which of the palette's colours paints the path: 0 for the primary.
  var layer: Int?
  /// In multicolor rendering, a colour of the symbol's own, `#rrggbb`, which the icon's colour
  /// does not change.
  var color: String?
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

/// The colours a palette is drawn in, so each path's colour says which of them paints it.
private let palette: [[CGFloat]] = [[1, 0, 0], [0, 1, 0], [0, 0, 1]]

private func color(_ components: [CGFloat]) -> Color {
  Color(.sRGB, red: components[0], green: components[1], blue: components[2])
}

private func hex(_ components: [CGFloat]) -> String {
  "#"
    + components.map { String(format: "%02x", Int((min(1, max(0, $0)) * 255).rounded())) }
    .joined()
}

/// The symbol as SwiftUI draws it, its foreground in `foreground` where the rendering has one.
@MainActor
private func symbol(_ name: String, _ request: RenderRequest, _ foreground: [CGFloat]) -> AnyView {
  let image = Image(systemName: name, variableValue: request.variable)
    .font(.system(size: request.size, weight: weights[request.weight] ?? .regular))
    .imageScale(scales[request.scale] ?? .medium)
  switch request.rendering {
  case "hierarchical":
    return AnyView(image.symbolRenderingMode(.hierarchical).foregroundStyle(color(foreground)))
  case "palette":
    return AnyView(
      image.symbolRenderingMode(.palette)
        .foregroundStyle(color(palette[0]), color(palette[1]), color(palette[2])))
  case "multicolor":
    return AnyView(image.symbolRenderingMode(.multicolor).foregroundStyle(color(foreground)))
  default:
    return AnyView(image.symbolRenderingMode(.monochrome).foregroundStyle(color(foreground)))
  }
}

/// The symbol's drawing as a one-page PDF, and the box SwiftUI lays it out in.
@MainActor
private func pdf(_ view: AnyView) -> (Data, CGSize)? {
  var result: (Data, CGSize)?
  ImageRenderer(content: view).render { size, draw in
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

/// A drawing whose paths cannot be told apart as the rendering needs.
struct UnmatchedDrawing: Error {
  var reason: String
}

/// The fills SwiftUI draws for a symbol with its foreground in `foreground`, and its layout box.
@available(macOS 14, *)
@MainActor
private func drawing(_ name: String, _ request: RenderRequest, _ foreground: [CGFloat]) throws
  -> ([Outline], CGSize)?
{
  guard let (data, layout) = pdf(symbol(name, request, foreground)) else { return nil }
  return (try outlines(ofPDF: data), layout)
}

/// Each path's part in the rendering: its palette colour, or its own colour where it keeps one.
/// Multicolor symbols are drawn a second time in another foreground: the paths whose colour
/// follows it take the icon's colour, and the rest keep their own.
@available(macOS 14, *)
@MainActor
private func roles(_ name: String, _ request: RenderRequest, _ drawn: [Outline]) throws
  -> [(layer: Int?, color: String?)]
{
  switch request.rendering {
  case "palette":
    return try drawn.map { outline in
      guard let layer = palette.firstIndex(of: outline.color) else {
        throw UnmatchedDrawing(reason: "a path is painted in none of the palette's colours")
      }
      return (layer, nil)
    }
  case "multicolor":
    guard let (other, _) = try drawing(name, request, [1, 1, 1]), other.count == drawn.count else {
      throw UnmatchedDrawing(reason: "its paths differ with the foreground colour")
    }
    return zip(drawn, other).map { first, second in
      (nil, first.color == second.color ? hex(first.color) : nil)
    }
  default:
    return drawn.map { _ in (nil, nil) }
  }
}

/// A symbol as an icon, or nil when this Mac has no symbol by that name or draws it in a way its
/// outlines cannot be read from, which is reported rather than drawn incomplete.
@available(macOS 14, *)
@MainActor
func icon(_ name: String, _ request: RenderRequest) -> Icon? {
  guard NSImage(systemSymbolName: name, accessibilityDescription: nil) != nil else { return nil }
  let drawn: [Outline]
  let layout: CGSize
  let parts: [(layer: Int?, color: String?)]
  do {
    guard let (outlines, box) = try drawing(name, request, [0, 0, 0]) else { return nil }
    drawn = outlines
    layout = box
    parts = try roles(name, request, drawn)
  } catch let unreadable as UnreadableDrawing {
    let operators = unreadable.operators.sorted().joined(separator: ", ")
    FileHandle.standardError.write(
      Data("SF Symbols: \(name) paints with \(operators), which outlines cannot read\n".utf8))
    return nil
  } catch let unmatched as UnmatchedDrawing {
    FileHandle.standardError.write(
      Data("SF Symbols: \(name) in \(request.rendering): \(unmatched.reason)\n".utf8))
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
    paths: zip(drawn, parts).map { outline, part in
      IconPath(
        d: pathData(outline.path, transform), opacity: outline.opacity, layer: part.layer,
        color: part.color)
    })
}
