import { isEqual } from 'es-toolkit'

function isNativeMap(value: unknown): value is Map<unknown, unknown> {
  try {
    Map.prototype.has.call(value, undefined)
    return true
  } catch {
    return false
  }
}

function isNativeSet(value: unknown): value is Set<unknown> {
  try {
    Set.prototype.has.call(value, undefined)
    return true
  } catch {
    return false
  }
}

function isStringIndex(value: unknown): value is Map<string, Set<string>> {
  if (
    !isNativeMap(value) ||
    Object.getPrototypeOf(value) !== Map.prototype ||
    Reflect.ownKeys(value).length
  )
    return false
  for (const [key, members] of value) {
    if (
      typeof key !== 'string' ||
      !isNativeSet(members) ||
      Object.getPrototypeOf(members) !== Set.prototype ||
      Reflect.ownKeys(members).length
    )
      return false
    for (const member of members) if (typeof member !== 'string') return false
  }
  return true
}

export function equalInstanceIndexes(before: unknown, after: unknown): boolean {
  if (!isStringIndex(before) || !isStringIndex(after)) return isEqual(before, after)
  if (before.size !== after.size) return false
  for (const [id, members] of before) {
    const current = after.get(id)
    if (!current || members.size !== current.size) return false
    for (const member of members) if (!current.has(member)) return false
  }
  return true
}
