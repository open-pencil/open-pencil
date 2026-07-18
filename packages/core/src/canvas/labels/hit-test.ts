import type { Font } from 'canvaskit-wasm'

import type { SceneGraph, SceneNode } from '@open-pencil/scene-graph'
import type { Vector } from '@open-pencil/scene-graph/primitives'

import {
  COMPONENT_LABEL_FONT_SIZE,
  COMPONENT_LABEL_GAP,
  COMPONENT_LABEL_ICON_GAP,
  COMPONENT_LABEL_ICON_SIZE,
  LABEL_FONT_SIZE,
  LABEL_OFFSET_Y,
  SECTION_TITLE_GAP,
  SECTION_TITLE_HEIGHT,
  SECTION_TITLE_PADDING_X
} from '#core/constants'

import type { CachedComponent, CachedFrame, CachedSection, LabelCache } from './cache'

function measureGlyphWidth(font: Font, text: string): number {
  const glyphIds = font.getGlyphIDs(text)
  const widths = font.getGlyphWidths(glyphIds)
  let total = 0
  for (const w of widths) total += w
  return total
}

function rotatePoint(x: number, y: number, rotation: number): Vector {
  if (rotation === 0) return { x, y }
  const rad = (-rotation * Math.PI) / 180
  const cos = Math.cos(rad)
  const sin = Math.sin(rad)
  return { x: x * cos - y * sin, y: x * sin + y * cos }
}

function hitInRect(px: number, py: number, x: number, y: number, w: number, h: number): boolean {
  return px >= x && px <= x + w && py >= y && py <= y + h
}

type LabelWalkerCallback = (
  child: SceneNode,
  parent: SceneNode,
  absX: number,
  absY: number,
  insideSection: boolean
) => SceneNode | null | undefined

function walkLabelTree(
  graph: SceneGraph,
  pageId: string,
  callback: LabelWalkerCallback
): SceneNode | null {
  let result: SceneNode | null = null

  const walk = (parentId: string, ox: number, oy: number, insideSection: boolean) => {
    const parent = graph.getNode(parentId)
    if (!parent) return
    for (let i = parent.childIds.length - 1; i >= 0; i--) {
      if (result) return
      const child = graph.getNode(parent.childIds[i])
      if (!child || !child.visible) continue
      const ax = ox + child.x
      const ay = oy + child.y
      const hit = callback(child, parent, ax, ay, insideSection)
      if (hit) {
        result = hit
        return
      }
      if (child.type === 'SECTION') {
        walk(child.id, ax, ay, true)
      } else if (child.childIds.length > 0) {
        walk(child.id, ax, ay, insideSection)
      }
    }
  }

  const pageNode = graph.getNode(pageId)
  if (pageNode) walk(pageNode.id, 0, 0, false)
  return result
}

interface LabelHitContext {
  canvasX: number
  canvasY: number
  zoom: number
  font: Font
}

function labelHitContext(
  canvasX: number,
  canvasY: number,
  zoom: number,
  font: Font
): LabelHitContext {
  return { canvasX, canvasY, zoom, font }
}

function hitCachedLabel<T extends { nodeId: string; absX: number; absY: number }>(
  graph: SceneGraph,
  items: readonly T[],
  hit: (node: SceneNode, item: T) => SceneNode | null
): SceneNode | null {
  for (let i = items.length - 1; i >= 0; i--) {
    const item = items[i]
    const node = graph.getNode(item.nodeId)
    if (!node || !node.visible) continue
    const result = hit(node, item)
    if (result) return result
  }
  return null
}

function hitCachedLabelWithContext<T extends { nodeId: string; absX: number; absY: number }>(
  graph: SceneGraph,
  items: readonly T[],
  context: LabelHitContext,
  hit: (node: SceneNode, item: T, context: LabelHitContext) => SceneNode | null
): SceneNode | null {
  return hitCachedLabel(graph, items, (node, item) => hit(node, item, context))
}

function hitSectionTitle(
  child: SceneNode,
  ax: number,
  ay: number,
  insideSection: boolean,
  canvasX: number,
  canvasY: number,
  zoom: number,
  font: Font
): SceneNode | null {
  const textW = measureGlyphWidth(font, child.name)
  const pillW = Math.min(textW + SECTION_TITLE_PADDING_X * 2, child.width * zoom) / zoom
  const pillH = SECTION_TITLE_HEIGHT / zoom
  const gap = SECTION_TITLE_GAP / zoom
  const hit = rotatePoint(canvasX - ax, canvasY - ay, child.rotation)
  const pillY = insideSection ? gap : -pillH - gap

  return hitInRect(hit.x, hit.y, 0, pillY, pillW, pillH) ? child : null
}

function hitCachedSectionTitle(
  child: SceneNode,
  section: CachedSection,
  context: LabelHitContext
): SceneNode | null {
  return hitSectionTitle(
    child,
    section.absX,
    section.absY,
    section.nested,
    context.canvasX,
    context.canvasY,
    context.zoom,
    context.font
  )
}

export function hitTestSectionTitle(
  graph: SceneGraph,
  canvasX: number,
  canvasY: number,
  zoom: number,
  pageId: string,
  font: Font | null,
  labelCache?: LabelCache
): SceneNode | null {
  if (!font) return null

  if (labelCache) {
    return hitCachedLabelWithContext(
      graph,
      labelCache.getAllSections(),
      labelHitContext(canvasX, canvasY, zoom, font),
      hitCachedSectionTitle
    )
  }

  return walkLabelTree(graph, pageId, (child, _parent, ax, ay, insideSection) => {
    if (child.type !== 'SECTION') return undefined
    return hitSectionTitle(child, ax, ay, insideSection, canvasX, canvasY, zoom, font)
  })
}

function hitComponentLabel(
  child: SceneNode,
  ax: number,
  ay: number,
  canvasX: number,
  canvasY: number,
  zoom: number,
  font: Font
): SceneNode | null {
  const textW = measureGlyphWidth(font, child.name)
  const labelW = (COMPONENT_LABEL_ICON_SIZE + COMPONENT_LABEL_ICON_GAP + textW) / zoom
  const labelH = COMPONENT_LABEL_FONT_SIZE / zoom
  const gap = COMPONENT_LABEL_GAP / zoom
  const labelY = ay - labelH - gap

  return hitInRect(canvasX, canvasY, ax, labelY, labelW, labelH) ? child : null
}

function hitCachedComponentLabel(
  child: SceneNode,
  component: CachedComponent,
  context: LabelHitContext
): SceneNode | null {
  const { canvasX, canvasY, zoom, font } = context
  return hitComponentLabel(child, component.absX, component.absY, canvasX, canvasY, zoom, font)
}

export function hitTestComponentLabel(
  graph: SceneGraph,
  canvasX: number,
  canvasY: number,
  zoom: number,
  pageId: string,
  font: Font | null,
  labelCache?: LabelCache
): SceneNode | null {
  if (!font) return null

  const cachedHit = labelCache
    ? hitCachedLabelWithContext(
        graph,
        labelCache.getAllComponents(),
        labelHitContext(canvasX, canvasY, zoom, font),
        hitCachedComponentLabel
      )
    : null
  if (cachedHit) return cachedHit

  const LABEL_TYPES = new Set(['COMPONENT', 'COMPONENT_SET'])

  return walkLabelTree(graph, pageId, (child, _parent, ax, ay) => {
    if (!LABEL_TYPES.has(child.type)) return undefined
    return hitComponentLabel(child, ax, ay, canvasX, canvasY, zoom, font)
  })
}

export function hitTestFrameTitle(
  graph: SceneGraph,
  canvasX: number,
  canvasY: number,
  zoom: number,
  selectedIds: Set<string>,
  font: Font | null
): SceneNode | null {
  if (!font || selectedIds.size !== 1) return null

  const id = [...selectedIds][0]
  const node = graph.getNode(id)
  if (node?.type !== 'FRAME') return null

  const abs = graph.getAbsolutePosition(id)
  const labelW = measureGlyphWidth(font, node.name) / zoom
  const labelH = LABEL_FONT_SIZE / zoom
  const hit = rotatePoint(canvasX - abs.x, canvasY - abs.y, node.rotation)
  const labelY = -LABEL_OFFSET_Y / zoom - labelH

  return hitInRect(hit.x, hit.y, 0, labelY, labelW, labelH) ? node : null
}

function hitCachedFrameTitle(
  child: SceneNode,
  item: CachedFrame,
  context: LabelHitContext
): SceneNode | null {
  const { canvasX, canvasY, zoom, font } = context
  const labelW = measureGlyphWidth(font, child.name) / zoom
  const labelH = LABEL_FONT_SIZE / zoom
  const hit = rotatePoint(canvasX - item.absX, canvasY - item.absY, child.rotation)
  const labelY = -LABEL_OFFSET_Y / zoom - labelH
  return hitInRect(hit.x, hit.y, 0, labelY, labelW, labelH) ? child : null
}

export function hitTestFrameTitles(
  graph: SceneGraph,
  canvasX: number,
  canvasY: number,
  zoom: number,
  font: Font | null,
  labelCache?: LabelCache
): SceneNode | null {
  if (!font) return null
  if (labelCache) {
    return hitCachedLabelWithContext(
      graph,
      labelCache.getAllFrames(),
      labelHitContext(canvasX, canvasY, zoom, font),
      hitCachedFrameTitle
    )
  }
  return null
}
