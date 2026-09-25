import type { NodeChange } from '@open-pencil/kiwi/fig/codec'

import { LAYOUT_DISTANCE_FIELDS } from './fields'
import type { InstanceOccurrence } from './interpret'
import { occurrences } from './occurrence-path'
import { scaleTextLayout } from './text-scale'
import { uniformScaleOf } from './types'

// Distances only: sizing modes, grow factors, and alignment are dimensionless.
const LAYOUT_DISTANCES = ['stackPadding', ...Object.values(LAYOUT_DISTANCE_FIELDS)] as const
const VISUAL_LENGTHS = [
  'strokeWeight',
  'cornerRadius',
  'rectangleTopLeftCornerRadius',
  'rectangleTopRightCornerRadius',
  'rectangleBottomLeftCornerRadius',
  'rectangleBottomRightCornerRadius'
] as const
const TEXT_LENGTHS = [
  'fontSize',
  'lineHeight',
  'letterSpacing',
  'textData',
  'derivedTextData'
] as const

/**
 * Every field the scaler touches. An instance record declares these in placed space, so
 * after its expansion is scaled the record's own values are restored verbatim.
 */
const SCALED_FIELDS = [
  ...LAYOUT_DISTANCES,
  ...VISUAL_LENGTHS,
  ...TEXT_LENGTHS,
  'dashPattern',
  'effects',
  'size',
  'transform'
] as const

function scaleRawVisualProps(props: NodeChange, factor: number): void {
  for (const field of VISUAL_LENGTHS) {
    const value = props[field]
    if (typeof value === 'number') props[field] = value * factor
  }
  if (props.dashPattern) props.dashPattern = props.dashPattern.map((value) => value * factor)
  if (props.effects)
    props.effects = props.effects.map((effect) => ({
      ...effect,
      offset: effect.offset
        ? { x: effect.offset.x * factor, y: effect.offset.y * factor }
        : effect.offset,
      radius: typeof effect.radius === 'number' ? effect.radius * factor : effect.radius,
      spread: typeof effect.spread === 'number' ? effect.spread * factor : effect.spread
    }))
}

/**
 * Expansion is in component space; an instance's own NodeChange distances are
 * already in placed space. Explicit path claims are applied before this stage,
 * and saved derived bounds afterwards. Nested expansions are normalized first.
 */
export function applyInstanceLayoutScale(root: InstanceOccurrence, source: NodeChange): void {
  const factor = uniformScaleOf(source)
  if (!Number.isFinite(factor) || factor <= 0) throw new Error('Invalid instance uniform scale')
  if (factor === 1) return
  for (const node of occurrences(root)) {
    node.layoutScale = (node.layoutScale ?? 1) * factor
    for (const field of Object.keys(node.variableBindingScales ?? {})) {
      if (node.variableBindingScales && field !== 'opacity' && field !== 'rotation')
        node.variableBindingScales[field] *= factor
    }
    const props = node.properties
    scaleTextLayout(props, factor)
    scaleRawVisualProps(props, factor)
    for (const field of LAYOUT_DISTANCES) {
      const value = props[field]
      if (typeof value === 'number') props[field] = value * factor
    }
    if (props.size) props.size = { x: props.size.x * factor, y: props.size.y * factor }
    if (props.transform)
      props.transform = {
        ...props.transform,
        m02: props.transform.m02 * factor,
        m12: props.transform.m12 * factor
      }
    if (node.derivedSize)
      node.derivedSize = {
        x: node.derivedSize.x * factor,
        y: node.derivedSize.y * factor
      }
  }
  for (const field of SCALED_FIELDS) {
    const value = source[field]
    if (value !== undefined) Object.assign(root.properties, { [field]: structuredClone(value) })
  }
}
