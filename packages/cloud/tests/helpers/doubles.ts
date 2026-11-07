/**
 * Tests drive entry points with stand-ins that implement only the slice of a large interface the
 * case under test touches, such as a Durable Object's state, which only workerd builds. The
 * widening happens here once, in one named place, instead of as a cast at every call site.
 */
export function asDouble<T>(double: object): T {
  return double as T
}
