import { uniq } from 'es-toolkit/array'
import { computed } from 'vue'

import type { SceneNode, TextLength } from '@open-pencil/scene-graph'
import { MIXED } from '@open-pencil/vue/controls/node-props'

type LengthField = 'lineHeight' | 'letterSpacing'

/**
 * A line height or letter spacing as the panel edits it: in the unit the layers share, pixels or
 * a percent of the font size, so an edit keeps that unit. Layers in other units read Mixed.
 */
export function useTextLength(
  nodes: () => readonly SceneNode[],
  field: LengthField,
  fallback: (node: SceneNode) => number
) {
  const lengths = computed(() => nodes().map((node): TextLength | null => node[field]))
  const unit = computed((): TextLength['unit'] => {
    const units = uniq(lengths.value.flatMap((length) => (length ? [length.unit] : [])))
    return units.length === 1 ? units[0] : 'PIXELS'
  })
  const value = computed(() => {
    const values = nodes().map((node, index) => {
      const length = lengths.value[index]
      if (!length) return unit.value === 'PIXELS' ? fallback(node) : null
      return length.unit === unit.value ? length.value : null
    })
    const [first] = values
    return first != null && values.every((current) => current === first) ? first : MIXED
  })
  const suffix = computed(() => (unit.value === 'PERCENT' ? '%' : 'px'))
  const length = (value: number): TextLength => ({ value, unit: unit.value })
  return { unit, value, suffix, length }
}
