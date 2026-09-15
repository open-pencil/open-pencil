import type { SceneGraph, SceneNode } from '@open-pencil/scene-graph'

import type { RenderOverlays } from '#core/canvas/renderer'
import { createSceneGeometry } from '#core/geometry'

export interface CachedSection {
  nodeId: string
  absX: number
  absY: number
  nested: boolean
}

export interface CachedComponent {
  nodeId: string
  absX: number
  absY: number
  parentType: string
}

interface Viewport {
  x: number
  y: number
  w: number
  h: number
}

const LABEL_TYPES = new Set(['COMPONENT', 'COMPONENT_SET'])
const COMPONENT_LABEL_PARENT_TYPES = new Set(['CANVAS', 'SECTION'])

function isInViewport(absX: number, absY: number, w: number, h: number, vp: Viewport): boolean {
  return absX + w >= vp.x && absY + h >= vp.y && absX <= vp.x + vp.w && absY <= vp.y + vp.h
}

function collectVisibleLabels<
  T extends { nodeId: string; absX: number; absY: number },
  U extends object
>(
  graph: SceneGraph,
  viewport: Viewport,
  cachedItems: T[],
  metadata: (cached: T) => U,
  preview: RenderOverlays['rotationPreview']
): Array<{ node: SceneNode; absX: number; absY: number } & U> {
  const result: Array<{ node: SceneNode; absX: number; absY: number } & U> = []
  const geometry = createSceneGeometry(graph, preview)
  for (const cached of cachedItems) {
    const node = graph.getNode(cached.nodeId)
    if (!node) continue
    const bounds = geometry.bounds(node)
    if (!isInViewport(bounds.x, bounds.y, bounds.width, bounds.height, viewport)) continue
    const origin = geometry.toWorld(node, { x: 0, y: 0 })
    result.push({ node, absX: origin.x, absY: origin.y, ...metadata(cached) })
  }
  return result
}

export class LabelCache {
  private sections: CachedSection[] = []
  private components: CachedComponent[] = []
  private cachedSceneVersion = -1
  private cachedPositionPreviewVersion = -1
  private cachedPageId: string | null = null

  update(
    graph: SceneGraph,
    pageId: string | null,
    sceneVersion: number,
    positionPreviewVersion = graph.positionPreviewVersion
  ): void {
    if (
      sceneVersion === this.cachedSceneVersion &&
      positionPreviewVersion === this.cachedPositionPreviewVersion &&
      pageId === this.cachedPageId
    ) {
      return
    }
    this.rebuild(graph, pageId)
    this.cachedSceneVersion = sceneVersion
    this.cachedPositionPreviewVersion = positionPreviewVersion
    this.cachedPageId = pageId
  }

  invalidate(): void {
    this.cachedSceneVersion = -1
    this.cachedPositionPreviewVersion = -1
    this.cachedPageId = null
    this.sections = []
    this.components = []
  }

  getSections(
    graph: SceneGraph,
    viewport: Viewport,
    preview?: RenderOverlays['rotationPreview']
  ): Array<{ node: SceneNode; absX: number; absY: number; nested: boolean }> {
    return collectVisibleLabels(
      graph,
      viewport,
      this.sections,
      (cached) => ({
        nested: cached.nested
      }),
      preview
    )
  }

  getComponents(
    graph: SceneGraph,
    viewport: Viewport,
    preview?: RenderOverlays['rotationPreview']
  ): Array<{ node: SceneNode; absX: number; absY: number; inside: boolean }> {
    return collectVisibleLabels(
      graph,
      viewport,
      this.components,
      () => ({
        inside: false
      }),
      preview
    )
  }

  getAllSections(): readonly CachedSection[] {
    return this.sections
  }

  getAllComponents(): readonly CachedComponent[] {
    return this.components
  }

  private rebuild(graph: SceneGraph, pageId: string | null): void {
    this.sections = []
    this.components = []

    const pageNode = graph.getNode(pageId ?? graph.rootId)
    if (!pageNode) return

    this.walkChildren(graph, pageNode.id, false)
  }

  private walkChildren(graph: SceneGraph, parentId: string, insideSection: boolean): void {
    const parent = graph.getNode(parentId)
    if (!parent) return
    const parentType = parent.type

    for (const childId of parent.childIds) {
      const child = graph.getNode(childId)
      if (!child || !child.visible) continue

      if (child.type === 'SECTION') {
        const origin = graph.getAbsolutePosition(childId)
        this.sections.push({
          nodeId: childId,
          absX: origin.x,
          absY: origin.y,
          nested: insideSection
        })
        this.walkChildren(graph, childId, true)
      } else if (LABEL_TYPES.has(child.type)) {
        if (COMPONENT_LABEL_PARENT_TYPES.has(parentType)) {
          const origin = graph.getAbsolutePosition(childId)
          this.components.push({ nodeId: childId, absX: origin.x, absY: origin.y, parentType })
        }
        if (child.childIds.length > 0) {
          this.walkChildren(graph, childId, insideSection)
        }
      } else if (child.childIds.length > 0) {
        this.walkChildren(graph, childId, insideSection)
      }
    }
  }
}
