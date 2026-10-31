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
  skip?: ReadonlySet<keyof T>
): FieldChanges<T> | null {
  let result: FieldChanges<T> | null = null
  const keys = new Set([...Object.keys(previous), ...Object.keys(current)] as (keyof T)[])
  for (const key of keys) {
    if (skip?.has(key)) continue
    const existed = Object.hasOwn(previous, key)
    const exists = Object.hasOwn(current, key)
    if (existed === exists) {
      const beforeValue = previous[key]
      const afterValue = current[key]
      if (beforeValue === afterValue || isEqual(beforeValue, afterValue)) continue
    }
    result ??= { id, before: {}, after: {}, absent: { before: [], after: [] } }
    result.before[key] = structuredClone(previous[key])
    result.after[key] = structuredClone(current[key])
    if (!existed) result.absent.before.push(key)
    if (!exists) result.absent.after.push(key)
  }
  return result && Object.keys(result.after).length ? result : null
}
