import type { NodeChange } from '#core/kiwi/fig/codec'
import type { FontVariation } from '#core/scene-graph'

function figmaAxisTagToString(axisTag: number): string {
  return String.fromCharCode(
    (axisTag >> 24) & 0xff,
    (axisTag >> 16) & 0xff,
    (axisTag >> 8) & 0xff,
    axisTag & 0xff
  )
}

export function convertFontVariations(nc: NodeChange): FontVariation[] {
  const result: FontVariation[] = []
  for (const variation of nc.fontVariations ?? []) {
    if (typeof variation.value !== 'number') continue
    const axis =
      variation.axisName ||
      (typeof variation.axisTag === 'number' ? figmaAxisTagToString(variation.axisTag) : '')
    if (axis) result.push({ axis, value: variation.value })
  }
  return result
}
