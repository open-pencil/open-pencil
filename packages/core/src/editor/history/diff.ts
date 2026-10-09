import { isEqual } from 'es-toolkit'

/** The fields one record changed, each side holding its own copy of the values. */
export interface FieldChanges<T> {
  id: string
  before: Partial<T>
  after: Partial<T>
  /** Fields a side does not have, so restoring that side removes them. */
  absent: Record<'before' | 'after', (keyof T)[]>
}

/** Compares two states of one record field by field; `null` when nothing differs. */
export function diffFields<T extends object>(
  id: string,
  previous: T,
  current: T,
  skip: ReadonlySet<keyof T> = new Set()
): FieldChanges<T> | null {
  const before: Partial<T> = {}
  const after: Partial<T> = {}
  const absent: FieldChanges<T>['absent'] = { before: [], after: [] }
  const keys = new Set([...Object.keys(previous), ...Object.keys(current)] as (keyof T)[])
  for (const key of keys) {
    if (skip.has(key)) continue
    const existed = Object.hasOwn(previous, key)
    const exists = Object.hasOwn(current, key)
    if (existed === exists && isEqual(previous[key], current[key])) continue
    before[key] = structuredClone(previous[key])
    after[key] = structuredClone(current[key])
    if (!existed) absent.before.push(key)
    if (!exists) absent.after.push(key)
  }
  return Object.keys(after).length ? { id, before, after, absent } : null
}
