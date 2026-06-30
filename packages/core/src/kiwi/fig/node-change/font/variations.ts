import type { NodeChange } from '@open-pencil/kiwi/fig/codec'
import type { FontVariation } from '@open-pencil/scene-graph'

export function figmaAxisTagToString(axisTag: number): string {
  return String.fromCharCode(
    (axisTag >> 24) & 0xff,
    (axisTag >> 16) & 0xff,
    (axisTag >> 8) & 0xff,
    axisTag & 0xff
  )
}

export function stringToFigmaAxisTag(axis: string): number | undefined {
  if (axis.length !== 4) return undefined
  return (
    ((axis.charCodeAt(0) << 24) |
      (axis.charCodeAt(1) << 16) |
      (axis.charCodeAt(2) << 8) |
      axis.charCodeAt(3)) >>>
    0
  )
}

export function convertFontVariations(nc: NodeChange): FontVariation[] {
  const result: FontVariation[] = []
  for (const variation of nc.fontVariations ?? []) {
    if (typeof variation.value !== 'number') continue
    const axis =
      typeof variation.axisTag === 'number'
        ? figmaAxisTagToString(variation.axisTag)
        : variation.axisName || ''
    if (axis) result.push({ axis, value: variation.value })
  }
  return result
}
