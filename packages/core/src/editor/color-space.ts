import { resolveOkHCLForPreview } from '#core/color/management'
import { rgbaToOkHCL } from '#core/color/okhcl'
import { copyEffects, copyFill, copyStyleRuns, copyStroke } from '#core/scene-graph/copy'

import type { DocumentColorSpace, SceneNode } from '#core/scene-graph'
import type { EditorContext } from './types'

export type DocumentColorProfileMode = 'assign' | 'convert'

function remapColor(color: SceneNode['fills'][number]['color'], target: DocumentColorSpace) {
  return resolveOkHCLForPreview(rgbaToOkHCL(color), { documentColorSpace: target }).color
}

function remapNodeColors(
  node: SceneNode,
  target: DocumentColorSpace,
  mode: DocumentColorProfileMode
): Partial<SceneNode> | null {
  if (mode === 'assign') return null

  const fills = node.fills.map((fill) => {
    const next = copyFill(fill)
    if (fill.type === 'SOLID') {
      const resolved = remapColor(fill.color, target)
      next.color = resolved
      next.opacity = resolved.a
      return next
    }
    if (fill.gradientStops) {
      next.gradientStops = fill.gradientStops.map((stop) => ({
        ...stop,
        color: remapColor(stop.color, target)
      }))
    }
    return next
  })

  const strokes = node.strokes.map((stroke) => {
    const next = copyStroke(stroke)
    const resolved = remapColor(stroke.color, target)
    next.color = resolved
    next.opacity = resolved.a
    return next
  })

  const effects = copyEffects(node.effects).map((effect) => ({
    ...effect,
    color: remapColor(effect.color, target)
  }))

  const styleRuns = copyStyleRuns(node.styleRuns).map((run) => ({
    ...run,
    style: {
      ...run.style,
      fills: run.style.fills?.map((fill) => {
        const next = copyFill(fill)
        if (fill.type === 'SOLID') {
          const resolved = remapColor(fill.color, target)
          next.color = resolved
          next.opacity = resolved.a
        }
        return next
      })
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
