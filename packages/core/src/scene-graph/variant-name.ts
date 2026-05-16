export function parseVariantName(name: string): Record<string, string> {
  const values: Record<string, string> = {}
  for (const part of name.split(',').map((s) => s.trim())) {
    const eqIdx = part.indexOf('=')
    if (eqIdx === -1) continue
    values[part.slice(0, eqIdx).trim()] = part.slice(eqIdx + 1).trim()
  }
  return values
}

export function buildVariantName(values: Record<string, string>): string {
  return Object.entries(values)
    .map(([k, v]) => `${k}=${v}`)
    .join(', ')
}
