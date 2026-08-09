/**
 * Strip Vue reactive proxies from values entering the scene graph, without
 * depending on Vue: reactive proxies answer the `__v_raw` magic key with
 * their raw target (Vue's ReactiveFlags.RAW — the same escape hatch toRaw()
 * uses); plain values answer undefined.
 *
 * Why the graph must stay proxy-free: app-side callers hold node data in
 * refs/reactive state (drag state, panel models), so values read through
 * them arrive wrapped. A stored proxy poisons the document for every
 * structuredClone consumer — export's subgraph clone and undo snapshots
 * throw DataCloneError ("[object Array] could not be cloned").
 *
 * Recursion is needed because a caller can build a plain container from
 * proxied elements (spreading a reactive array wraps each element). Only
 * arrays and plain objects are walked; typed arrays, Maps, and class
 * instances pass through untouched. Elements are replaced in place — the
 * graph takes ownership of change payloads anyway.
 */
/** Vue reactive proxies answer this magic key with their raw target. */
interface ReactiveCarrier {
  __v_raw?: object
}

function rawTarget<T extends object>(value: T): T {
  return ((value as ReactiveCarrier).__v_raw as T | undefined) ?? value
}

function isPlainRecord(value: object): value is Record<string, unknown> {
  const proto: unknown = Object.getPrototypeOf(value)
  return proto === Object.prototype || proto === null
}

export function toRawDeep<T>(value: T): T {
  if (value === null || typeof value !== 'object') return value
  const raw = rawTarget(value)
  if (Array.isArray(raw)) {
    for (let i = 0; i < raw.length; i++) raw[i] = toRawDeep(raw[i])
    return raw
  }
  // Widen away the generic so the guarded record stays writable.
  const record: object = raw
  if (isPlainRecord(record)) {
    for (const key of Object.keys(record)) record[key] = toRawDeep(record[key])
  }
  return raw
}
