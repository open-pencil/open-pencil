import type { Effect } from '@open-pencil/scene-graph'

import type { KiwiNodeChange, SceneNodeToKiwiContext } from './context'

/**
 * Effects as Kiwi writes them. `scale` divides their lengths, for a claim written in an
 * instance's own space.
 */
export function kiwiEffects(
  context: Pick<SceneNodeToKiwiContext, 'safeColor'>,
  effects: readonly Effect[],
  scale = 1
): NonNullable<KiwiNodeChange['effects']> {
  return effects.map((effect) => ({
    type: effect.type === 'LAYER_BLUR' ? 'FOREGROUND_BLUR' : effect.type,
    color: context.safeColor(effect.color),
    offset: { x: effect.offset.x / scale, y: effect.offset.y / scale },
    radius: effect.radius / scale,
    spread: effect.spread / scale,
    visible: effect.visible,
    blendMode: effect.blendMode ?? 'NORMAL',
    showShadowBehindNode: effect.showShadowBehindNode
  }))
}
