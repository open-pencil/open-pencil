import type { NodeChange } from '@open-pencil/kiwi/fig/codec'
import type { Vector } from '@open-pencil/scene-graph'

const scaledVector = (value: Vector, factor: number): Vector => ({
  x: value.x * factor,
  y: value.y * factor
})

/** Scale positional text data, not font identity or normalized glyph outlines. */
export function scaleTextLayout(props: NodeChange, factor: number): void {
  if (props.fontSize !== undefined) props.fontSize *= factor
  for (const field of ['lineHeight', 'letterSpacing'] as const) {
    const value = props[field]
    if (value?.units === 'PIXELS') props[field] = { ...value, value: value.value * factor }
  }
  if (props.textData?.styleOverrideTable) {
    props.textData = structuredClone(props.textData)
    for (const style of props.textData.styleOverrideTable ?? []) scaleTextLayout(style, factor)
  }
  if (!props.derivedTextData) return
  const derived = structuredClone(props.derivedTextData)
  if (derived.layoutSize) derived.layoutSize = scaledVector(derived.layoutSize, factor)
  if (derived.truncatedHeight !== undefined) derived.truncatedHeight *= factor
  for (const glyph of derived.glyphs ?? []) {
    glyph.position = scaledVector(glyph.position, factor)
    glyph.fontSize *= factor
  }
  for (const baseline of derived.baselines ?? []) {
    baseline.position = scaledVector(baseline.position, factor)
    baseline.width *= factor
    baseline.lineHeight *= factor
    baseline.lineAscent *= factor
    if (baseline.lineY !== undefined) baseline.lineY *= factor
  }
  props.derivedTextData = derived
}
