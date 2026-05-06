export function isDefaultName(name: string): boolean {
  return /^(Frame|Rectangle|Ellipse|Line|Text|Group|Vector|Polygon|Star|Section|Component|Instance|Slice)\s*\d*$/i.test(
    name
  )
}

export function isMultipleOf(value: number, base: number, tolerance = 0.01): boolean {
  if (base === 0) return false
  const remainder = value % base
  return remainder < tolerance || base - remainder < tolerance
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

export function relativeLuminance(rgb: { r: number; g: number; b: number }): number {
  const [r, g, b] = [rgb.r, rgb.g, rgb.b].map((c) =>
    c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  ) as [number, number, number]
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

export function contrastRatio(
  a: { r: number; g: number; b: number },
  b: { r: number; g: number; b: number }
): number {
  const l1 = relativeLuminance(a)
  const l2 = relativeLuminance(b)
  const lighter = Math.max(l1, l2)
  const darker = Math.min(l1, l2)
  return (lighter + 0.05) / (darker + 0.05)
}

export const SPACING_SCALE = [0, 1, 2, 4, 8, 12, 16, 20, 24, 32, 40, 48, 56, 64, 80, 96, 128]
