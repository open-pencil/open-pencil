import { isEqual, isPlainObject } from 'es-toolkit'
import * as Y from 'yjs'

/**
 * Records in a room by id, as variables and collections are. Each record is a map of its fields,
 * so peers changing different fields of one record both keep theirs.
 */
export type YRecords = Y.Map<Y.Map<unknown>>

/** A room map that holds one record's fields, as a layer's or a variable's does. */
export type YFields = Pick<Y.Map<unknown>, 'delete' | 'get' | 'has' | 'keys' | 'set'>

type WriteOptions = {
  /**
   * Fields that hold a map of their own, keyed by id or mode, written field by field in turn, so
   * peers changing different entries of one field both keep theirs.
   */
  nested?: ReadonlySet<string>
  /** Whether fields `record` lacks are removed from the room; false leaves them as they are. */
  drop?: boolean
}

/**
 * Writes the fields of `record` that differ from what the room holds, as a peer sends its edit:
 * a field another peer changed meanwhile keeps that change unless this record changes it too.
 */
export function writeRecord(
  target: YFields,
  record: object,
  { nested, drop = true }: WriteOptions = {}
): void {
  const fields = new Map<string, unknown>(Object.entries(record))
  if (drop) {
    // Collected first: deleting from a Yjs map while iterating its keys skips some.
    for (const key of Array.from(target.keys())) if (!fields.has(key)) target.delete(key)
  }
  for (const [key, value] of fields) {
    if (nested?.has(key) && isPlainObject(value)) {
      let entries = target.get(key)
      if (!(entries instanceof Y.Map)) {
        entries = new Y.Map<unknown>()
        target.set(key, entries)
      }
      writeRecord(entries as Y.Map<unknown>, value, { drop })
      continue
    }
    if (value === undefined) {
      if (target.has(key)) target.delete(key)
    } else if (!isEqual(target.get(key), value)) target.set(key, structuredClone(value))
  }
}

/** Writes `records` that differ from `sent` into the room, and removes those gone since. */
export function writeChanges<T extends object>(
  target: YRecords,
  records: ReadonlyMap<string, T>,
  sent: ReadonlyMap<string, T>,
  options?: Omit<WriteOptions, 'drop'>
): void {
  for (const id of sent.keys()) if (!records.has(id)) target.delete(id)
  for (const [id, record] of records) {
    if (isEqual(sent.get(id), record)) continue
    let ymap = target.get(id)
    if (!ymap) {
      ymap = new Y.Map<unknown>()
      target.set(id, ymap)
    }
    writeRecord(ymap, record, options)
  }
}

/** The ids of records an event batch on `records` added, changed, or removed. */
export function changedIds(records: YRecords, events: Y.YEvent<Y.Map<unknown>>[]): Set<string> {
  const ids = new Set<string>()
  for (const event of events) {
    if (event.target === records) {
      for (const key of event.changes.keys.keys()) ids.add(key)
      continue
    }
    const [id] = event.path
    if (typeof id === 'string') ids.add(id)
  }
  return ids
}
