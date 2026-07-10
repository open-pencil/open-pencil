/**
 * Pick a display name that does not collide with existing cloud canvas names.
 * First free: `Name`, then `Name (1)`, `Name (2)`, …
 */
export function nextUniqueCloudName(desired: string, taken: Iterable<string>): string {
  const used = new Set<string>()
  for (const name of taken) {
    const trimmed = name.trim()
    if (trimmed) used.add(trimmed)
  }

  const base = desired.trim() || 'Untitled'
  if (!used.has(base)) return base

  for (let n = 1; n < 10_000; n++) {
    const candidate = `${base} (${n})`
    if (!used.has(candidate)) return candidate
  }

  // Extremely unlikely — still avoid silent overwrite of the display name.
  const bytes = new Uint8Array(4)
  crypto.getRandomValues(bytes)
  const suffix = [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('')
  return `${base} (${suffix})`
}
