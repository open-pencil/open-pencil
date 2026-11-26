import { randomHex } from '@open-pencil/std/random'

/**
 * Pick a display name that does not collide with existing stored document names.
 * First free: `Name`, then `Name (1)`, `Name (2)`, …
 */
export function nextUniqueStorageName(desired: string, taken: Iterable<string>): string {
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
  for (;;) {
    const suffix = randomHex(4)
    const candidate = `${base} (${suffix})`
    if (!used.has(candidate)) return candidate
  }
}
