export function requireTransferReference(
  ids: ReadonlyMap<string, string>,
  id: string,
  kind: string
): string {
  const value = ids.get(id)
  if (!value) throw new Error(`Missing ${kind} transfer mapping: ${id}`)
  return value
}
