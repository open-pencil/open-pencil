/** An object whose properties are not known yet, to read after checking each one. */
export type UnknownRecord = Record<string, unknown>

/** Whether `value` is an object to read properties from: not null, and not an array. */
export function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
