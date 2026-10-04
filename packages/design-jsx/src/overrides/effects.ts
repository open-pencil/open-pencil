import type { Effect, SceneNode } from '@open-pencil/scene-graph'
import { parseColor } from '@open-pencil/scene-graph/color'
import { TRANSPARENT } from '@open-pencil/scene-graph/constants'

function isEffect(value: unknown): value is Effect {
  return (
    value !== null &&
    typeof value === 'object' &&
    'type' in value &&
    'radius' in value &&
    'visible' in value
  )
}

function shadowShorthand(value: string): Effect | null {
  const parts = value.split(/\s+/)
  if (parts.length < 4) return null
  return {
    type: 'DROP_SHADOW',
    color: parseColor(parts.slice(3).join(' ')),
    offset: { x: Number.parseFloat(parts[0]), y: Number.parseFloat(parts[1]) },
    radius: Number.parseFloat(parts[2]),
    spread: 0,
    visible: true
  }
}

/** `effects` takes structured effects; `shadow` and `blur` append one drop shadow or layer blur. */
export function applyEffectOverrides(props: Record<string, unknown>, o: Partial<SceneNode>): void {
  if (Array.isArray(props.effects)) {
    const effects = props.effects.filter(isEffect).map((effect) => structuredClone(effect))
    if (effects.length > 0) o.effects = effects
  }

  const shadow = typeof props.shadow === 'string' ? shadowShorthand(props.shadow) : null
  if (shadow) o.effects = [...(o.effects ?? []), shadow]

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
