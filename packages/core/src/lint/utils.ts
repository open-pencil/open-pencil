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

export const SPACING_SCALE = [0, 1, 2, 4, 8, 12, 16, 20, 24, 32, 40, 48, 56, 64, 80, 96, 128]
