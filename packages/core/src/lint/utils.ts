export function isDefaultName(name: string): boolean {
  return /^(Frame|Rectangle|Ellipse|Line|Text|Group|Vector|Polygon|Star|Section|Component|Instance|Slice)\s*\d*$/i.test(
    name
  )
}

/**
 * Lowercase words of a layer name, split at separators and camelCase humps, so name heuristics
 * match whole words: "IconButton" and "icon-button" yield `icon`, `button`, "Button2" yields
 * `button`, `2`, and "Rectangle" does not contain `cta`.
 */
export function nameWords(name: string): string[] {
  return name
    .replaceAll(/([a-z\d])([A-Z])/g, '$1 $2')
    .replaceAll(/([a-z])(\d)/gi, '$1 $2')
    .toLowerCase()
    .split(/[^a-z\d]+/)
    .filter(Boolean)
}

export function isMultipleOf(value: number, base: number, tolerance = 0.01): boolean {
  if (base === 0) return false
  const remainder = value % base
  return remainder < tolerance || base - remainder < tolerance
}

/** The candidate closest to `value`; a tie goes to the larger candidate. */
export function nearestValue(value: number, candidates: Iterable<number>): number | null {
  let best: number | null = null
  for (const candidate of candidates) {
    if (best === null) best = candidate
    const distance = Math.abs(candidate - value)
    const bestDistance = Math.abs(best - value)
    if (distance < bestDistance || (distance === bestDistance && candidate > best)) best = candidate
  }
  return best
}

interface LintPathNode {
  name: string
  parent?: LintPathNode
}

export function getNodePath(node: LintPathNode): string[] {
  const path: string[] = []
  let current: LintPathNode | undefined = node
  while (current) {
    path.unshift(current.name)
    current = current.parent
  }
  return path
}

export const SPACING_SCALE = [0, 1, 2, 4, 8, 12, 16, 20, 24, 32, 40, 48, 56, 64, 80, 96, 128]
