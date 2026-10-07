import type { Font } from 'canvaskit-wasm'

import type { SceneGraph, SceneNode } from '@open-pencil/scene-graph'

import type { RotationPreview } from '#core/geometry'

import { LabelCache } from './cache'
import {
  labelLayout,
  labelViewport,
  type LabelKind,
  type LabelLayout,
  type LabelTextMetrics
} from './layout'
import { measureGlyphWidth } from './paragraph-cache'
import { frameLabelPlacement, labelLocalPoint, labelTransform } from './transform'

export interface LabelHitOptions {
  preview?: RotationPreview | null
  viewport?: Parameters<LabelCache['getSections']>[1]
  measure?: (node: SceneNode, layout: LabelLayout) => LabelTextMetrics | null
}

function hitLabel(
  node: SceneNode,
  graph: SceneGraph,
  kind: LabelKind,
  inside: boolean,
  canvasX: number,
  canvasY: number,
  zoom: number,
  font: Font,
  options: LabelHitOptions
): SceneNode | null {
  const placement =
    kind === 'frame'
      ? frameLabelPlacement(node, graph, options.preview)
      : { ...labelTransform(node, graph, options.preview), width: node.width }
  let layout = labelLayout(kind, placement.width * zoom, inside)
  if (!layout) return null
  const point = labelLocalPoint(placement, zoom, {
    x: canvasX,
    y: canvasY
  })
  if (!point || point.x < 0 || point.x > placement.width * zoom || point.y < layout.bounds.y)
    return null
  if (kind === 'section' && point.y > layout.bounds.y + layout.bounds.height) return null
  const metrics = options.measure
    ? options.measure(node, layout)
    : { width: measureGlyphWidth(font, node.name), height: layout.fontSize }
  if (!metrics) return null
  layout = labelLayout(kind, placement.width * zoom, inside, metrics)
  if (!layout) return null
  const { x, y, width, height } = layout.bounds
  return point.x >= x && point.x <= x + width && point.y >= y && point.y <= y + height ? node : null
}

function catalog(graph: SceneGraph, pageId: string, existing?: LabelCache): LabelCache {
  if (existing) return existing
  const cache = new LabelCache()
  cache.update(graph, pageId, 0)
  return cache
}

function catalogHitTest(kind: 'section' | 'component' | 'frame') {
  return function hitTest(
    graph: SceneGraph,
    canvasX: number,
    canvasY: number,
    zoom: number,
    pageId: string,
    font: Font | null,
    labelCache?: LabelCache,
    options: LabelHitOptions = {}
  ): SceneNode | null {
    if (!font) return null
    const cache = catalog(graph, pageId, labelCache)
    const viewport = options.viewport ? labelViewport(options.viewport, zoom) : undefined
    let candidates: Array<{ nodeId: string; inside: boolean }>
    if (kind === 'section') {
      const sections = viewport
        ? cache
            .getSections(graph, viewport, options.preview)
            .map(({ node, nested }) => ({ nodeId: node.id, nested }))
        : cache.getAllSections()
      candidates = sections.map(({ nodeId, nested }) => ({ nodeId, inside: nested }))
    } else if (kind === 'frame') {
      const frames = viewport
        ? cache.getFrames(graph, viewport, options.preview).map(({ node }) => ({ nodeId: node.id }))
        : cache.getAllFrames()
      candidates = frames.map(({ nodeId }) => ({ nodeId, inside: false }))
    } else {
      const components = viewport
        ? cache
            .getComponents(graph, viewport, options.preview)
            .map(({ node }) => ({ nodeId: node.id }))
        : cache.getAllComponents()
      candidates = components.map(({ nodeId }) => ({ nodeId, inside: false }))
    }
    for (let i = candidates.length - 1; i >= 0; i--) {
      const candidate = candidates[i]
      const node = graph.getNode(candidate.nodeId)
      // Locked frames cannot be selected on the canvas, by their name either.
      if (!node?.visible || (kind === 'frame' && node.locked)) continue
      const hit = hitLabel(
        node,
        graph,
        kind,
        candidate.inside,
        canvasX,
        canvasY,
        zoom,
        font,
        options
      )
      if (hit) return hit
    }
    return null
  }
}
export const hitTestSectionTitle = catalogHitTest('section')

export const hitTestComponentLabel = catalogHitTest('component')

/**
 * The top-level frame whose name is under a point, selected or not: a frame on the page or in a
 * section shows its name, and clicking it selects the frame even when its body is a background.
 */
export const hitTestFrameTitle = catalogHitTest('frame')
