import CoreGraphics
import Foundation

/// One filled shape of a drawing, in the PDF page's coordinates.
struct Outline {
  var path: CGPath
  var opacity: CGFloat
  /// The fill's lightness, which is what a soft mask reads.
  var gray: CGFloat
}

/// What `q` saves and `Q` restores.
private struct GraphicsState {
  var transform = CGAffineTransform.identity
  var gray: CGFloat = 0
  var opacity: CGFloat = 1
  /// Where a soft mask hides what is drawn, cut out of every later fill.
  var knockout: CGPath?
}

/// A drawing that paints with operators outlines cannot read, such as strokes or images.
struct UnreadableDrawing: Error {
  var operators: Set<String>
}

/// The fills a PDF content stream draws, read operator by operator.
@available(macOS 14, *)
private final class Reader {
  var states = [GraphicsState()]
  var path = CGMutablePath()
  var outlines: [Outline] = []
  /// The painting operators met that this reader does not read.
  var unsupported: Set<String> = []

  var state: GraphicsState {
    get { states[states.count - 1] }
    set { states[states.count - 1] = newValue }
  }

  func point(_ x: CGFloat, _ y: CGFloat) -> CGPoint {
    CGPoint(x: x, y: y).applying(state.transform)
  }

  func fill(_ rule: CGPathFillRule) {
    var shape: CGPath = path.normalized(using: rule)
    if let knockout = state.knockout { shape = shape.subtracting(knockout) }
    if !shape.isEmpty { outlines.append(Outline(path: shape, opacity: state.opacity, gray: state.gray)) }
    path = CGMutablePath()
  }
}

private func numbers(_ scanner: CGPDFScannerRef, _ count: Int) -> [CGFloat] {
  var values = [CGFloat](repeating: 0, count: count)
  for index in (0..<count).reversed() {
    var value: CGPDFReal = 0
    CGPDFScannerPopNumber(scanner, &value)
    values[index] = value
  }
  return values
}

private func name(_ scanner: CGPDFScannerRef) -> String? {
  var value: UnsafePointer<CChar>?
  guard CGPDFScannerPopName(scanner, &value), let value else { return nil }
  return String(cString: value)
}

@available(macOS 14, *)
private func reader(_ info: UnsafeMutableRawPointer?) -> Reader {
  Unmanaged<Reader>.fromOpaque(info!).takeUnretainedValue()
}

/// A form's matrix, which maps its space into the space it is drawn in.
private func matrix(_ form: CGPDFStreamRef) -> CGAffineTransform {
  guard let dictionary = CGPDFStreamGetDictionary(form) else { return .identity }
  var array: CGPDFArrayRef?
  guard CGPDFDictionaryGetArray(dictionary, "Matrix", &array), let array,
    CGPDFArrayGetCount(array) == 6
  else { return .identity }
  let values = (0..<6).map { index -> CGFloat in
    var value: CGPDFReal = 0
    CGPDFArrayGetNumber(array, index, &value)
    return value
  }
  return CGAffineTransform(
    a: values[0], b: values[1], c: values[2], d: values[3], tx: values[4], ty: values[5])
}

/// The fills of a form, drawn with `transform`, read with a reader of their own; what that reader
/// cannot read is `reader`'s too.
@available(macOS 14, *)
private func formOutlines(
  _ form: CGPDFStreamRef, parent: CGPDFContentStreamRef, transform: CGAffineTransform,
  for reader: Reader
) -> [Outline] {
  let nested = Reader()
  nested.state.transform = matrix(form).concatenating(transform)
  guard let dictionary = CGPDFStreamGetDictionary(form) else { return [] }
  var resources: CGPDFDictionaryRef?
  CGPDFDictionaryGetDictionary(dictionary, "Resources", &resources)
  // A form without resources of its own finds them in the stream that draws it.
  let stream = CGPDFContentStreamCreateWithStream(form, resources ?? dictionary, parent)
  scan(stream, nested)
  reader.unsupported.formUnion(nested.unsupported)
  return nested.outlines
}

/// Whether an XObject is a form, a content stream of its own, rather than an image.
private func isForm(_ stream: CGPDFStreamRef) -> Bool {
  var subtype: UnsafePointer<CChar>?
  guard let dictionary = CGPDFStreamGetDictionary(stream),
    CGPDFDictionaryGetName(dictionary, "Subtype", &subtype), let subtype
  else { return false }
  return String(cString: subtype) == "Form"
}

/// The stream a resource names, such as a form XObject.
private func resourceStream(
  _ scanner: CGPDFScannerRef, _ category: String, _ key: String
) -> CGPDFStreamRef? {
  let content = CGPDFScannerGetContentStream(scanner)
  guard let object = CGPDFContentStreamGetResource(content, category, key) else { return nil }
  var stream: CGPDFStreamRef?
  return CGPDFObjectGetValue(object, .stream, &stream) ? stream : nil
}

@available(macOS 14, *)
private let operators: CGPDFOperatorTableRef = {
  let table = CGPDFOperatorTableCreate()!
  func on(_ name: String, _ callback: @escaping CGPDFOperatorCallback) {
    CGPDFOperatorTableSetCallback(table, name, callback)
  }
  on("q") { _, info in
    let reader = reader(info)
    reader.states.append(reader.state)
  }
  on("Q") { _, info in
    let reader = reader(info)
    if reader.states.count > 1 { reader.states.removeLast() }
  }
  on("cm") { scanner, info in
    let reader = reader(info)
    let n = numbers(scanner, 6)
    reader.state.transform = CGAffineTransform(
      a: n[0], b: n[1], c: n[2], d: n[3], tx: n[4], ty: n[5]
    ).concatenating(reader.state.transform)
  }
  on("m") { scanner, info in
    let reader = reader(info)
    let n = numbers(scanner, 2)
    reader.path.move(to: reader.point(n[0], n[1]))
  }
  on("l") { scanner, info in
    let reader = reader(info)
    let n = numbers(scanner, 2)
    reader.path.addLine(to: reader.point(n[0], n[1]))
  }
  on("c") { scanner, info in
    let reader = reader(info)
    let n = numbers(scanner, 6)
    reader.path.addCurve(
      to: reader.point(n[4], n[5]), control1: reader.point(n[0], n[1]),
      control2: reader.point(n[2], n[3]))
  }
  on("v") { scanner, info in
    let reader = reader(info)
    let n = numbers(scanner, 4)
    reader.path.addCurve(
      to: reader.point(n[2], n[3]), control1: reader.path.currentPoint,
      control2: reader.point(n[0], n[1]))
  }
  on("y") { scanner, info in
    let reader = reader(info)
    let n = numbers(scanner, 4)
    let end = reader.point(n[2], n[3])
    reader.path.addCurve(to: end, control1: reader.point(n[0], n[1]), control2: end)
  }
  on("h") { _, info in reader(info).path.closeSubpath() }
  on("re") { scanner, info in
    let reader = reader(info)
    let n = numbers(scanner, 4)
    reader.path.addLines(between: [
      reader.point(n[0], n[1]), reader.point(n[0] + n[2], n[1]),
      reader.point(n[0] + n[2], n[1] + n[3]), reader.point(n[0], n[1] + n[3]),
    ])
    reader.path.closeSubpath()
  }
  // Clips here only bound a form to its box, so the path they end is dropped.
  on("n") { _, info in reader(info).path = CGMutablePath() }
  on("f") { _, info in reader(info).fill(.winding) }
  on("F") { _, info in reader(info).fill(.winding) }
  on("f*") { _, info in reader(info).fill(.evenOdd) }
  // A soft mask's gray is all that matters: black hides, white shows.
  on("g") { scanner, info in reader(info).state.gray = numbers(scanner, 1)[0] }
  // A gray colour space sets one component, an RGB one three.
  on("sc") { scanner, info in
    let reader = reader(info)
    var n: [CGFloat] = []
    var value: CGPDFReal = 0
    while CGPDFScannerPopNumber(scanner, &value) { n.insert(value, at: 0) }
    switch n.count {
    case 1: reader.state.gray = n[0]
    case 3: reader.state.gray = 0.2126 * n[0] + 0.7152 * n[1] + 0.0722 * n[2]
    default: break
    }
  }
  on("gs") { scanner, info in
    let reader = reader(info)
    guard let key = name(scanner) else { return }
    let content = CGPDFScannerGetContentStream(scanner)
    var dictionary: CGPDFDictionaryRef?
    guard let object = CGPDFContentStreamGetResource(content, "ExtGState", key),
      CGPDFObjectGetValue(object, .dictionary, &dictionary), let dictionary
    else { return }
    var opacity: CGPDFReal = 1
    if CGPDFDictionaryGetNumber(dictionary, "ca", &opacity) { reader.state.opacity = opacity }
    var mask: CGPDFDictionaryRef?
    var group: CGPDFStreamRef?
    if CGPDFDictionaryGetDictionary(dictionary, "SMask", &mask), let mask,
      CGPDFDictionaryGetStream(mask, "G", &group), let group
    {
      // The mask is drawn over white, so what it fills in black is hidden.
      let hidden = formOutlines(
        group, parent: content, transform: reader.state.transform, for: reader
      )
        .filter { $0.gray < 0.5 }
        .reduce(CGMutablePath()) { union, outline in
          union.addPath(outline.path)
          return union
        }
      reader.state.knockout = hidden.normalized()
    } else {
      var none: UnsafePointer<CChar>?
      if CGPDFDictionaryGetName(dictionary, "SMask", &none) { reader.state.knockout = nil }
    }
  }
  on("Do") { scanner, info in
    let reader = reader(info)
    guard let key = name(scanner), let form = resourceStream(scanner, "XObject", key) else {
      return
    }
    guard isForm(form) else {
      reader.unsupported.insert("Do (image)")
      return
    }
    let content = CGPDFScannerGetContentStream(scanner)
    let drawn = formOutlines(form, parent: content, transform: reader.state.transform, for: reader)
    for var outline in drawn {
      if let knockout = reader.state.knockout { outline.path = outline.path.subtracting(knockout) }
      outline.opacity *= reader.state.opacity
      reader.outlines.append(outline)
    }
  }
  // Painting the reader does not read. Clips are left out: the `re W n` that bounds a form to its
  // box is all SwiftUI writes, and `n` ends it.
  on("S") { _, info in reader(info).unsupported.insert("S") }
  on("s") { _, info in reader(info).unsupported.insert("s") }
  on("B") { _, info in reader(info).unsupported.insert("B") }
  on("B*") { _, info in reader(info).unsupported.insert("B*") }
  on("b") { _, info in reader(info).unsupported.insert("b") }
  on("b*") { _, info in reader(info).unsupported.insert("b*") }
  on("sh") { _, info in reader(info).unsupported.insert("sh") }
  on("BI") { _, info in reader(info).unsupported.insert("BI") }
  on("Tj") { _, info in reader(info).unsupported.insert("Tj") }
  on("TJ") { _, info in reader(info).unsupported.insert("TJ") }
  on("'") { _, info in reader(info).unsupported.insert("'") }
  on("\"") { _, info in reader(info).unsupported.insert("\"") }
  return table
}()

@available(macOS 14, *)
private func scan(_ stream: CGPDFContentStreamRef, _ reader: Reader) {
  let scanner = CGPDFScannerCreate(stream, operators, Unmanaged.passUnretained(reader).toOpaque())
  CGPDFScannerScan(scanner)
  CGPDFScannerRelease(scanner)
}

/// The fills of a one-page PDF, in its page's coordinates. Throws when the page paints with
/// operators this reader does not read, rather than leaving that painting out.
@available(macOS 14, *)
func outlines(ofPDF data: Data) throws -> [Outline] {
  guard let provider = CGDataProvider(data: data as CFData),
    let page = CGPDFDocument(provider)?.page(at: 1)
  else { return [] }
  let reader = Reader()
  scan(CGPDFContentStreamCreateWithPage(page), reader)
  guard reader.unsupported.isEmpty else { throw UnreadableDrawing(operators: reader.unsupported) }
  return reader.outlines
}
