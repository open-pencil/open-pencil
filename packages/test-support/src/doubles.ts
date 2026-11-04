/**
 * Tests drive entry points with stand-ins that implement only the slice of a large interface the
 * case under test touches, and some members (CanvasKit Embind handles, a live `EditorStore`) are
 * values a test cannot build. Such a stand-in can never match the real shape structurally, so the
 * widening happens here once, in one named place, instead of as an unexplained cast at every call
 * site.
 */
export function asDouble<T>(double: object): T {
  return double as T
}
