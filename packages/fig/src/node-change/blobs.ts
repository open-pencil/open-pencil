/** Whether a record field holds an index into its message's blobs, as path geometry does. */
export function isBlobIndexField(key: string): boolean {
  return key === 'commandsBlob' || key === 'vectorNetworkBlob'
}

/** A copy of a record, or any value in one, with each blob index it holds put through `map`. */
export function mapBlobIndices<T>(value: T, map: (index: number) => number): T {
  return remap(value, map) as T
}

function remap(value: unknown, map: (index: number) => number): unknown {
  if (value instanceof Uint8Array) return value
  if (Array.isArray(value)) return value.map((item) => remap(item, map))
  if (!value || typeof value !== 'object') return value
  return Object.fromEntries(
    Object.entries(value).map(([key, child]) => [
      key,
      isBlobIndexField(key) && typeof child === 'number' ? map(child) : remap(child, map)
    ])
  )
}
