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
  const compare = (key: keyof T) => {
    if (skip.has(key)) {
      return
    }
    const existed = Object.hasOwn(previous, key)
    const exists = Object.hasOwn(current, key)
    const same = previous[key] === current[key] || isEqual(previous[key], current[key])
    if (existed === exists && same) {
      return
    }
    before[key] = structuredClone(previous[key])
    after[key] = structuredClone(current[key])
    if (!existed) absent.before.push(key)
    if (!exists) absent.after.push(key)
  }
  for (const key of Object.keys(previous) as (keyof T)[]) {
    compare(key)
  }
  for (const key of Object.keys(current) as (keyof T)[]) {
    if (!Object.hasOwn(previous, key)) {
      compare(key)
    }
  }
  return Object.keys(after).length ? { id, before, after, absent } : null
}
