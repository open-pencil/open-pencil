import { BLACK } from '@open-pencil/core/constants'
import {
  copyEffects,
  copyFills,
  copyLayoutGrids,
  sharedStyleRefKey,
  type SceneNode,
  type SharedStyleKind
} from '@open-pencil/scene-graph'

function strokePaintsFromStyle(target: SceneNode, style: SceneNode): SceneNode['strokes'] {
  const fills = style.fills.filter((fill) => fill.type === 'SOLID')
  if (fills.length === 0) return target.strokes
  const fallback = target.strokes[0] ?? {
    type: 'SOLID' as const,
    color: BLACK,
    weight: 1,
    opacity: 1,
    visible: true,
    align: 'CENTER' as const
  }
  return fills.map((fill, index) => {
    const current = target.strokes[index] ?? fallback
    return {
      ...current,
      color: { ...fill.color },
      opacity: fill.opacity,
      visible: fill.visible
    }
  })
}

export function sharedStylePatch(
  kind: SharedStyleKind,
  target: SceneNode,
  styleId: string,
  style: SceneNode | null
): Partial<SceneNode> {
  const refKey = sharedStyleRefKey(kind)
  const patch: Partial<SceneNode> = { [refKey]: styleId }
  if (!style) return patch

  if (kind === 'fill') patch.fills = copyFills(style.fills)
  else if (kind === 'stroke') patch.strokes = strokePaintsFromStyle(target, style)
  else if (kind === 'effect') patch.effects = copyEffects(style.effects)
  else if (kind === 'grid') patch.layoutGrids = copyLayoutGrids(style.layoutGrids)
  else {
    Object.assign(patch, {
      fontFamily: style.fontFamily,
      fontWeight: style.fontWeight,
      italic: style.italic,
      fontSize: style.fontSize,
      lineHeight: style.lineHeight,
      letterSpacing: style.letterSpacing,
      textDecoration: style.textDecoration,
      textCase: style.textCase
    })
  }
  return patch
}

export function sharedStyleDetachPatch(kind: SharedStyleKind): Partial<SceneNode> {
  return { [sharedStyleRefKey(kind)]: null }
}
