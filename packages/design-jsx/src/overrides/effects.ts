import type { Effect, SceneNode } from '@open-pencil/scene-graph'
import { TRANSPARENT } from '@open-pencil/scene-graph/constants'
import { parseCSSShadows } from '@open-pencil/scene-graph/css'

function isEffect(value: unknown): value is Effect {
  return (
    value !== null &&
    typeof value === 'object' &&
    'type' in value &&
    'radius' in value &&
    'visible' in value
  )
}

/** `effects` takes structured effects; `shadow` appends its shadows and `blur` a layer blur. */
export function applyEffectOverrides(props: Record<string, unknown>, o: Partial<SceneNode>): void {
  if (Array.isArray(props.effects)) {
    const effects = props.effects.filter(isEffect).map((effect) => structuredClone(effect))
    if (effects.length > 0) o.effects = effects
  }

  // A CSS shadow list, as `box-shadow` takes it.
  const shadows = typeof props.shadow === 'string' ? parseCSSShadows(props.shadow) : []
  if (shadows.length > 0) o.effects = [...(o.effects ?? []), ...shadows]

  if (typeof props.blur === 'number') {
    o.effects = [
      ...(o.effects ?? []),
      {
        type: 'LAYER_BLUR',
        radius: props.blur,
        visible: true,
        color: { ...TRANSPARENT },
        offset: { x: 0, y: 0 },
        spread: 0
      }
    ]
  }
}
