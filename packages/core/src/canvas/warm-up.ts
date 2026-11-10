import type { Canvas, Surface } from '@open-pencil/canvaskit'
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

/**
 * A layer for the warm-up to draw. Programs do not depend on size, so it is small: a glass
 * outline's geometry map covers the whole layer at each scale.
 */
function warmUpLayer(type: SceneNode['type'], effects: Effect[], size = 96): SceneNode {
  // One id per kind, so the renderer's caches keep a single entry for each.
  return createDefaultNode(() => `effect-warm-up:${type}`, type, {
    width: size,
    height: size,
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

/** Draws each effect worth warming once at every warm-up scale. */
function drawWarmUp(r: SkiaRenderer, canvas: Canvas): void {
  const background = warmUpLayer('RECTANGLE', [blurEffect('BACKGROUND_BLUR', 40, true)])
  const layer = blurEffect('LAYER_BLUR', 40, true)
  const glass: Effect = {
    ...blurEffect('GLASS', 4, false),
    glass: { refraction: 0.8, depth: 20, lightAngle: -45, lightIntensity: 0.5, dispersion: 0.5 }
  }
  const glassBox = warmUpLayer('RECTANGLE', [glass], 16)
  const glassEllipse = warmUpLayer('ELLIPSE', [glass], 16)
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
  renderLayer: RenderLayer,
  sceneVersion: number,
  editing = false
): void {
  // Only once what is visible is drawn, with the view at rest and no edit under way: building
  // the programs would stall a drag, and the frame after the edit ends tries again.
  if (renderLayer === 'overlays' || editing) return
  if (r.effectProgramsWarm || r.tiledSceneBackgroundPending) return
  const pageId = r.pageId
  if (!pageId || r.navigationPhase !== 'idle' || r.effectWarmUpFailedPage === pageId) return
  // A page found without such effects is scanned again only once the document changes.
  const scan = r.effectWarmUpScan
  if (scan?.pageId === pageId && scan.sceneVersion === sceneVersion) return
  r.effectWarmUpScan = { pageId, sceneVersion }
  if (!pageHasHeavyEffects(graph, pageId)) return
  // Without the surface, or if making it or a draw fails, the page is not tried again, so a
  // failure is not retried every idle frame; another page that needs warming tries again, and
  // the programs are built when the canvas first draws them either way.
  let surface: Surface | null = null
  try {
    surface = makeTileSurface(r, WARM_UP_SIZE)
    if (!surface) {
      r.effectWarmUpFailedPage = pageId
      return
    }
    drawWarmUp(r, surface.getCanvas())
    surface.flush()
    r.effectProgramsWarm = true
  } catch {
    // Optional work: a failure must not interrupt the frame that ran it.
    r.effectLayerPaint.setImageFilter(null)
    r.effectWarmUpFailedPage = pageId
  } finally {
    surface?.delete()
  }
}
