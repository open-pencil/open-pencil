import type { Effect, SceneGraph, SceneNode } from '@open-pencil/scene-graph'
import { createDefaultNode } from '@open-pencil/scene-graph/node-defaults'

import { TRANSPARENT } from '#core/constants'

import { applyClippedBlur } from './effects'
import { renderGlassLight, renderGlassRefraction } from './glass/render'
import type { SkiaRenderer } from './renderer'
import type { RenderLayer } from './renderer/pipeline'
import { makeTileSurface } from './renderer/tiles/surface-pool'

/**
 * Device scales the warm-up draws at. WebGL builds a program for each kind of step and each blur
 * kernel width the first time it draws one, which stalls that frame; drawing these scales once
 * builds the ones zooming in and out reaches, wide blurs being shrunk to the same kernels.
 */
const WARM_UP_SCALES = [0.25, 0.5, 1, 2, 4] as const
const WARM_UP_SIZE = 128

/** Whether any layer on the page has a progressive blur or a glass effect. */
function pageHasHeavyEffects(graph: SceneGraph, pageId: string): boolean {
  const stack = [...graph.getChildren(pageId)]
  while (stack.length > 0) {
    const node = stack.pop()
    if (!node) continue
    if (
      node.effects.some(
        (effect) => effect.visible && (effect.progressive || effect.type === 'GLASS')
      )
    )
      return true
    stack.push(...graph.getChildren(node.id))
  }
  return false
}

function warmUpLayer(type: SceneNode['type'], effects: Effect[]): SceneNode {
  // One id per kind, so the renderer's caches keep a single entry for each.
  return createDefaultNode(() => `effect-warm-up:${type}`, type, {
    width: 96,
    height: 96,
    effects
  })
}

function blurEffect(type: Effect['type'], radius: number, progressive: boolean): Effect {
  return {
    type,
    color: { ...TRANSPARENT },
    offset: { x: 0, y: 0 },
    radius,
    spread: 0,
    visible: true,
    ...(progressive
      ? {
          progressive: {
            startRadius: 0,
            startOffset: { x: 0.5, y: 0 },
            endOffset: { x: 0.5, y: 1 }
          }
        }
      : {})
  }
}

/**
 * Draws a progressive background blur, a progressive layer blur, and glass over a rectangle and
 * an ellipse off screen at several scales, so the first zoom over such layers does not stall
 * while WebGL builds their programs. Once per canvas that draws the scene, after a page that uses
 * them settles.
 */
export function warmUpEffectPrograms(
  r: SkiaRenderer,
  graph: SceneGraph,
  renderLayer: RenderLayer
): void {
  // Only once what is visible is drawn, with the view at rest.
  if (renderLayer === 'overlays' || r.effectProgramsWarm || r.tiledSceneBackgroundPending) return
  if (!r.pageId || r.navigationPhase !== 'idle') return
  if (r.effectWarmUpCheckedPage === r.pageId) return
  r.effectWarmUpCheckedPage = r.pageId
  if (!pageHasHeavyEffects(graph, r.pageId)) return
  r.effectProgramsWarm = true
  const surface = makeTileSurface(r, WARM_UP_SIZE)
  if (!surface) return
  const background = warmUpLayer('RECTANGLE', [blurEffect('BACKGROUND_BLUR', 40, true)])
  const layer = blurEffect('LAYER_BLUR', 40, true)
  const glass: Effect = {
    ...blurEffect('GLASS', 4, false),
    glass: { refraction: 0.8, depth: 20, lightAngle: -45, lightIntensity: 0.5, dispersion: 0.5 }
  }
  const glassBox = warmUpLayer('RECTANGLE', [glass])
  const glassEllipse = warmUpLayer('ELLIPSE', [glass])
  try {
    const canvas = surface.getCanvas()
    for (const scale of WARM_UP_SCALES) {
      canvas.save()
      canvas.scale(scale, scale)
      applyClippedBlur(r, canvas, background, background.effects[0])
      r.effectLayerPaint.setImageFilter(r.getCachedLayerBlur(layer, 96, 96, null))
      canvas.saveLayer(r.effectLayerPaint, r.ck.LTRBRect(0, 0, 96, 96))
      r.effectLayerPaint.setImageFilter(null)
      canvas.drawRect(r.ck.LTRBRect(0, 0, 96, 96), r.auxFill)
      canvas.restore()
      for (const node of [glassBox, glassEllipse]) {
        renderGlassRefraction(r, canvas, node, glass, null)
        renderGlassLight(r, canvas, node, glass, null)
      }
      canvas.restore()
    }
    surface.flush()
  } finally {
    surface.delete()
  }
}
