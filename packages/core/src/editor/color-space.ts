import { resolveOkHCLForPreview } from '#core/color/management'
import { rgbaToOkHCL } from '#core/color/okhcl'
import type {
  Color,
  DocumentColorSpace,
  Fill,
  GradientFill,
  SceneNode,
  SolidFill
} from '#core/scene-graph'
import { copyEffects, copyFill, copyStyleRuns, copyStroke } from '#core/scene-graph/copy'

import type { EditorContext } from './types'

export type DocumentColorProfileMode = 'assign' | 'convert'

function remapColor(color: Color, target: DocumentColorSpace) {
  return resolveOkHCLForPreview(rgbaToOkHCL(color), { documentColorSpace: target }).color
}

function isGradientFill(fill: Fill): fill is GradientFill {
  return fill.type.startsWith('GRADIENT')
}

function remapFills(fills: SceneNode['fills'], target: DocumentColorSpace) {
  return fills.map((fill) => {
    if (fill.type === 'SOLID') {
      const next = copyFill(fill) as SolidFill
      next.color = remapColor(fill.color, target)
      next.opacity = next.color.a
      return next
    }
    if (isGradientFill(fill)) {
      const next = copyFill(fill) as GradientFill
      next.gradientStops = fill.gradientStops.map((stop) => ({
        ...stop,
        color: remapColor(stop.color, target)
      }))
      return next
    }
    return copyFill(fill)
  })
}

function remapNodeColors(
  node: SceneNode,
  target: DocumentColorSpace,
  mode: DocumentColorProfileMode
): Partial<SceneNode> | null {
  if (mode === 'assign') return null

  const fills = remapFills(node.fills, target)

  const strokes = node.strokes.map((stroke) => {
    const next = copyStroke(stroke)
    const resolved = remapColor(stroke.color, target)
    next.color = resolved
    next.opacity = resolved.a
    return next
  })

  const effects = copyEffects(node.effects).map((effect) => {
    if (effect.type === 'DROP_SHADOW' || effect.type === 'INNER_SHADOW') {
      return { ...effect, color: remapColor(effect.color, target) }
    }
    return effect
  })

  const styleRuns = copyStyleRuns(node.styleRuns).map((run) => ({
    ...run,
    style: {
      ...run.style,
      fills: run.style.fills ? remapFills(run.style.fills, target) : undefined
    }
  }))

  return { fills, strokes, effects, styleRuns }
}

export function createColorSpaceActions(ctx: EditorContext) {
  function setDocumentColorSpace(
    colorSpace: DocumentColorSpace,
    mode: DocumentColorProfileMode = 'assign'
  ) {
    if (ctx.graph.documentColorSpace === colorSpace) return

    if (mode === 'convert') {
      for (const node of ctx.graph.getAllNodes()) {
        const changes = remapNodeColors(node, colorSpace, mode)
        if (changes) ctx.graph.updateNode(node.id, changes)
      }
    }

    ctx.graph.documentColorSpace = colorSpace
    ctx.requestRender()
  }

  return {
    setDocumentColorSpace
  }
}
