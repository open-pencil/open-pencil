import type { CompactNode, CompactVectorPath } from '#design-json/compact/types'

/**
 * A vector layer of the compact view as a standalone SVG file, painted with its first fill and
 * its border; null for a layer that is not a vector or has no path.
 */
export function vectorSVG(node: CompactNode): string | null {
  const { vector } = node
  if (!vector) return null
  const paths = vector.paths.map((path) => pathElement(path, node))
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${vector.width}" height="${vector.height}" viewBox="0 0 ${vector.width} ${vector.height}" fill="none">`,
    ...paths.map((path) => `  ${path}`),
    '</svg>',
    ''
  ].join('\n')
}

function pathElement(path: CompactVectorPath, node: CompactNode): string {
  const attributes = [`d="${path.d}"`, ...fillAttributes(path, node), ...strokeAttributes(node)]
  return `<path ${attributes.join(' ')}/>`
}

function fillAttributes(path: CompactVectorPath, node: CompactNode): string[] {
  // An open path, such as a line, is only stroked.
  if (path.fillRule === 'none') return []
  const color = node.style?.fills?.find(isHexColor)
  if (!color) return []
  return [`fill="${color}"`, `fill-rule="${path.fillRule}"`]
}

function strokeAttributes(node: CompactNode): string[] {
  const border = node.style?.border
  const color = border?.colors.find(isHexColor)
  if (!border || !color) return []
  return [`stroke="${color}"`, `stroke-width="${border.width}"`]
}

/** Solid paints are hex colors; gradients and other paints are named by their kind. */
function isHexColor(paint: string): boolean {
  return paint.startsWith('#')
}
