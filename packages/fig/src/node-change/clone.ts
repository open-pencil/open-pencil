/** Plain Kiwi data: an object literal, so its own keys can be copied directly. */
function isPlainData(value: object): value is Record<string, unknown> {
  return Object.getPrototypeOf(value) === Object.prototype
}

function cloneValue(value: unknown): unknown {
  if (value === null || typeof value !== 'object') return value
  if (Array.isArray(value)) return value.map((entry) => cloneValue(entry))
  // Byte buffers and anything else that is not plain data keep the structured algorithm.
  if (!isPlainData(value)) return structuredClone(value)
  const copy: Record<string, unknown> = {}
  for (const key of Object.keys(value)) copy[key] = cloneValue(value[key])
  return copy
}

/**
 * Deep-copy an archive record. The interpreter owes every occurrence a payload that shares
 * no mutable data with the archive, and records are plain Kiwi data, so copying them
 * directly is several times quicker than `structuredClone` — which was the largest single
 * cost of opening a page.
 */
export function cloneRecord<T>(value: T): T {
  return cloneValue(value) as T
}
