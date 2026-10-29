import type { Effect } from '@open-pencil/scene-graph'

import { mapBlendMode } from './paints'
import type { PenEffect, PenNode } from './schema'
import { resolveBoolean, resolveColor, resolveNumber, type VarContext } from './variables'

const DEFAULT_SHADOW_COLOR = { r: 0, g: 0, b: 0, a: 0.25 }

function convertEffect(effect: PenEffect, ctx: VarContext): Effect | null {
  const base = {
    visible: resolveBoolean(effect.enabled, ctx),
    color: { ...DEFAULT_SHADOW_COLOR },
    offset: { x: 0, y: 0 },
    spread: 0,
    blendMode: mapBlendMode(effect.blendMode) ?? 'NORMAL'
  } satisfies Partial<Effect>
  if (effect.type === 'blur' || effect.type === 'background_blur') {
    return {
      ...base,
      type: effect.type === 'blur' ? 'LAYER_BLUR' : 'BACKGROUND_BLUR',
      radius: resolveNumber(effect.radius, ctx)
    }
  }
  if (effect.type !== 'shadow') return null
  return {
    ...base,
    type: effect.shadowType === 'inner' ? 'INNER_SHADOW' : 'DROP_SHADOW',
    color: effect.color ? resolveColor(effect.color, ctx) : base.color,
    offset: {
      x: resolveNumber(effect.offset?.x, ctx),
      y: resolveNumber(effect.offset?.y, ctx)
    },
    radius: resolveNumber(effect.blur, ctx),
    spread: resolveNumber(effect.spread, ctx)
  }
}

/** A node's effects; shader effects are not drawn. */
export function convertEffects(effect: PenNode['effect'], ctx: VarContext): Effect[] {
  if (!effect) return []
  const effects = Array.isArray(effect) ? effect : [effect]
  return effects.flatMap((item) => convertEffect(item, ctx) ?? [])
}
