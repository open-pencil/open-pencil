import type { NodeChange as KiwiNodeChange } from '@open-pencil/kiwi/fig/codec'
import { normalizeFontFamily, type SceneNode } from '@open-pencil/scene-graph'

import { weightToFigmaStyle } from '../font/style'
import { safeColor } from '../paint'

/** Figma stores `SPACE_EVENLY` as space-between. */
export function normalizeStackJustify(value: string | undefined): string | undefined {
  return value === 'SPACE_EVENLY' ? 'SPACE_BETWEEN' : value
}

export function normalizeStackCounterAlign(value: string | undefined): string | undefined {
  return value === 'SPACE_EVENLY' ? 'SPACE_BETWEEN' : value
}

export function normalizeStackCounterAlignItems(value: string | undefined): string | undefined {
  const normalized = normalizeStackCounterAlign(value)
  // Figma models cross-axis stretch on each child, not on counterAxisAlignItems.
  return normalized === 'STRETCH' ? 'MIN' : normalized
}

export function exportFontName(node: SceneNode): NonNullable<KiwiNodeChange['fontName']> {
  return {
    family: normalizeFontFamily(node.fontFamily),
    style: weightToFigmaStyle(node.fontWeight, node.italic),
    postscript: ''
  }
}

export function exportEffects(node: SceneNode): NonNullable<KiwiNodeChange['effects']> {
  return node.effects.map((effect) => ({
    type: effect.type === 'LAYER_BLUR' ? 'FOREGROUND_BLUR' : effect.type,
    color: safeColor(effect.color),
    offset: effect.offset,
    radius: effect.radius,
    spread: effect.spread,
    visible: effect.visible,
    blendMode: effect.blendMode ?? 'NORMAL',
    showShadowBehindNode: effect.showShadowBehindNode
  }))
}
