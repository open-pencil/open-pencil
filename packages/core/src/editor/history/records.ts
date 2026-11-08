import { isEqual, isPlainObject } from 'es-toolkit'

/** Which state of an edit: as it found the document, or as it left it. */
export type Side = 'before' | 'after'

/** A variable or collection on each side of an edit; `null` on the side it does not exist. */
export interface RecordChange<T> {
  id: string
  before: T | null
  after: T | null
}

/** Restores records in place where they exist, as views may hold them, as atomic tools do. */
/** Make `target` hold `value` under `id`, or nothing; an existing record is kept and rewritten. */
export function writeRecord<T extends object>(
  target: Map<string, T>,
  id: string,
  value: T | null
): void {
  const existing = target.get(id)
  if (!value) {
    target.delete(id)
  } else if (existing) {
    for (const key of Object.keys(existing)) {
      if (!Object.hasOwn(value, key)) Reflect.deleteProperty(existing, key)
    }
    Object.assign(existing, structuredClone(value))
  } else {
    target.set(id, structuredClone(value))
  }
}

export function restoreRecords<T extends object>(
  target: Map<string, T>,
  changes: RecordChange<T>[],
  side: Side,
  willChange: (id: string) => void
): void {
  for (const change of changes) {
    // An edit recording meanwhile, such as an agent's waiting on a download, sees undo's change.
    willChange(change.id)
    writeRecord(target, change.id, change[side])
  }
}

/** Records of one kind by id as an edit found them: `null` for one it added. */
export type RecordCopies<T> = Map<string, T | null>

export function copyRecord<T>(
  copies: RecordCopies<T>,
  live: ReadonlyMap<string, T>,
  id: string
): void {
  if (!copies.has(id)) copies.set(id, structuredClone(live.get(id) ?? null))
}

export function recordChangesOf<T>(
  copies: ReadonlyMap<string, T | null>,
  live: ReadonlyMap<string, T>
): RecordChange<T>[] {
  return [...copies].flatMap(([id, before]) => {
    const after = live.get(id) ?? null
    return isEqual(before, after) ? [] : [{ id, before, after: structuredClone(after) }]
  })
}

/**
 * `baseline`, a layer or record as it was before an edit, with what someone else changed on it
 * while the edit waited, from `atPause` to `live`, wherever the edit itself had left it alone:
 * field by field, and one level into fields that map keys to values, such as variable bindings
 * or a variable's values by mode, so independent entries of one field both survive.
 */
export function adoptChanges<T extends object>(baseline: T, atPause: T, live: T, depth = 1): T {
  const adopted = { ...baseline }
  for (const key of new Set([...Object.keys(atPause), ...Object.keys(live)])) {
    const paused: unknown = Reflect.get(atPause, key)
    const now: unknown = Reflect.get(live, key)
    const base: unknown = Reflect.get(baseline, key)
    const pausedHas = Object.hasOwn(atPause, key)
    const liveHas = Object.hasOwn(live, key)
    // Nobody else changed the field.
    if (pausedHas === liveHas && isEqual(paused, now)) continue
    if (Object.hasOwn(baseline, key) === pausedHas && isEqual(base, paused)) {
      if (liveHas) Reflect.set(adopted, key, structuredClone(now))
      else Reflect.deleteProperty(adopted, key)
    } else if (depth > 0 && isPlainObject(base) && isPlainObject(paused) && isPlainObject(now)) {
      Reflect.set(adopted, key, adoptChanges(base, paused, now, depth - 1))
    }
  }
  return adopted
}

/**
 * Takes in the changes someone else made to records while an edit waited: a record the edit had
 * copied starts from its new state wherever the edit left it alone, and one removed meanwhile is
 * no longer the edit's to restore. A record the edit had not copied yet is copied as it is when
 * the edit first changes it.
 */
export function adoptRecordChanges<T extends object>(
  copies: RecordCopies<T>,
  atPause: RecordCopies<T>,
  live: ReadonlyMap<string, T>
): void {
  for (const [id, paused] of atPause) {
    if (!copies.has(id)) continue
    const copy = copies.get(id) ?? null
    const now = live.get(id) ?? null
    if (isEqual(copy, paused)) copies.set(id, structuredClone(now))
    else if (!now) copies.delete(id)
    else if (copy && paused) copies.set(id, adoptChanges(copy, paused, now))
  }
}
