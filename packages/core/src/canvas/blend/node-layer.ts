import type { Canvas } from '@open-pencil/canvaskit'
import type { BlendMode, SceneGraph, SceneNode, VectorNetwork } from '@open-pencil/scene-graph'

import type { SkiaRenderer } from '#core/canvas/renderer/skia'
import { backdropReach } from '#core/canvas/renderer/visual-bounds'

import { needsIsolatedBlendLayer, saveBlendedLayer, saveLayerOverBackdrop } from './modes'

interface Blendable {
  visible: boolean
  blendMode?: BlendMode
}

function anyBlends(paints: readonly Blendable[] | undefined): boolean {
  if (!paints) {
    return false
  }
  for (const paint of paints) {
    if (paint.visible && needsIsolatedBlendLayer(paint.blendMode)) {
      return true
    }
  }
  return false
}

function regionFillsBlend(network: VectorNetwork | null): boolean {
  if (!network) {
    return false
  }
  for (const region of network.regions) {
    if (anyBlends(region.fills)) {
      return true
    }
  }
  return false
}

function styleRunsBlend(node: SceneNode): boolean {
  for (const run of node.styleRuns) {
    if (anyBlends(run.style.fills) || anyBlends(run.style.textDecorationFills)) {
      return true
    }
  }
  return false
}

function paintsBlend(node: SceneNode): boolean {
  return (
    anyBlends(node.fills) ||
    anyBlends(node.strokes) ||
    anyBlends(node.effects) ||
    anyBlends(node.textDecorationFills) ||
    regionFillsBlend(node.vectorNetwork) ||
    styleRunsBlend(node)
  )
}

function opensIsolatedLayer(node: SceneNode): boolean {
  return node.opacity < 1 && node.blendMode !== 'PASS_THROUGH'
}

function ownEffectsSeeBackdrop(node: SceneNode): boolean {
  for (const effect of node.effects) {
    if (effect.visible && (effect.type === 'BACKGROUND_BLUR' || effect.type === 'GLASS')) {
      return true
    }
  }
  return false
}

function childDrawsWithBackdrop(graph: SceneGraph, child: SceneNode): boolean {
  if (needsIsolatedBlendLayer(child.blendMode)) {
    return true
  }
  if (opensIsolatedLayer(child)) {
    return false
  }
  return (
    paintsBlend(child) || ownEffectsSeeBackdrop(child) || childrenDrawWithBackdrop(graph, child)
  )
}

function childrenDrawWithBackdrop(graph: SceneGraph, node: SceneNode): boolean {
  for (const childId of node.childIds) {
    const child = graph.getNode(childId)
    if (child?.visible && childDrawsWithBackdrop(graph, child)) {
      return true
    }
  }
  return false
}

function insideBackdropFreeLayer(r: SkiaRenderer): boolean {
  return r.backdropFreeLayers.at(-1) ?? false
}

function fadesOverBackdrop(
  r: SkiaRenderer,
  graph: SceneGraph,
  node: SceneNode,
  opacity: number
): boolean {
  return (
    opacity < 1 &&
    node.blendMode === 'PASS_THROUGH' &&
    !insideBackdropFreeLayer(r) &&
    (paintsBlend(node) || ownEffectsSeeBackdrop(node) || childrenDrawWithBackdrop(graph, node))
  )
}

function saveNodeLayer(
  r: SkiaRenderer,
  canvas: Canvas,
  graph: SceneGraph,
  node: SceneNode,
  opacity: number,
  bounds: Float32Array | null
): void {
  const fades = fadesOverBackdrop(r, graph, node, opacity)
  r.backdropFreeLayers.push(node.blendMode === 'PASS_THROUGH' && !fades)
  if (fades) {
    const reach = backdropReach(graph, node, true)
    saveLayerOverBackdrop(r, canvas, r.opacityPaint, opacity, bounds, reach)
    return
  }
  r.opacityPaint.setAlphaf(opacity)
  saveBlendedLayer(r, canvas, r.opacityPaint, node.blendMode, bounds)
}

export function withNodeLayer(
  r: SkiaRenderer,
  canvas: Canvas,
  graph: SceneGraph,
  node: SceneNode,
  opacity: number,
  bounds: Float32Array | null,
  draw: () => void
): void {
  const depth = r.backdropFreeLayers.length
  const saveCount = canvas.getSaveCount()
  try {
    saveNodeLayer(r, canvas, graph, node, opacity, bounds)
    draw()
  } finally {
    canvas.restoreToCount(saveCount)
    r.backdropFreeLayers.length = depth
    r.opacityPaint.setAlphaf(1)
    r.opacityPaint.setBlendMode(r.ck.BlendMode.SrcOver)
  }
}
