import type { SceneGraph, SceneNode } from '#core/scene-graph'

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
  metadata: (cached: T) => U
): Array<{ node: SceneNode; absX: number; absY: number } & U> {
  const result: Array<{ node: SceneNode; absX: number; absY: number } & U> = []
  for (const cached of cachedItems) {
    const node = graph.getNode(cached.nodeId)
    if (!node || !isInViewport(cached.absX, cached.absY, node.width, node.height, viewport))
      continue
    result.push({ node, absX: cached.absX, absY: cached.absY, ...metadata(cached) })
  }
  return result
}

export class LabelCache {
  private sections: CachedSection[] = []
  private components: CachedComponent[] = []
  private cachedSceneVersion = -1
  private cachedPageId: string | null = null

  update(graph: SceneGraph, pageId: string | null, sceneVersion: number): void {
    if (sceneVersion === this.cachedSceneVersion && pageId === this.cachedPageId) return
    this.rebuild(graph, pageId)
    this.cachedSceneVersion = sceneVersion
    this.cachedPageId = pageId
  }

  invalidate(): void {
    this.cachedSceneVersion = -1
    this.cachedPageId = null
    this.sections = []
    this.components = []
  }

  getSections(
    graph: SceneGraph,
    viewport: Viewport
  ): Array<{ node: SceneNode; absX: number; absY: number; nested: boolean }> {
    return collectVisibleLabels(graph, viewport, this.sections, (cached) => ({
      nested: cached.nested
    }))
  }

  getComponents(
    graph: SceneGraph,
    viewport: Viewport
  ): Array<{ node: SceneNode; absX: number; absY: number; inside: boolean }> {
    return collectVisibleLabels(graph, viewport, this.components, (cached) => ({
      inside: cached.parentType === 'COMPONENT_SET'
    }))
  }

  private rebuild(graph: SceneGraph, pageId: string | null): void {
    this.sections = []
    this.components = []

    const pageNode = graph.getNode(pageId ?? graph.rootId)
    if (!pageNode) return

    this.walkChildren(graph, pageNode.id, 0, 0, false)
  }

  private walkChildren(
    graph: SceneGraph,
    parentId: string,
    ox: number,
    oy: number,
    insideSection: boolean
  ): void {
    const parent = graph.getNode(parentId)
    if (!parent) return
    const parentType = parent.type

    for (const childId of parent.childIds) {
      const child = graph.getNode(childId)
      if (!child || !child.visible) continue
      const ax = ox + child.x
      const ay = oy + child.y

      if (child.type === 'SECTION') {
        this.sections.push({ nodeId: childId, absX: ax, absY: ay, nested: insideSection })
        this.walkChildren(graph, childId, ax, ay, true)
      } else if (LABEL_TYPES.has(child.type)) {
        this.components.push({ nodeId: childId, absX: ax, absY: ay, parentType })
        if (child.childIds.length > 0) {
          this.walkChildren(graph, childId, ax, ay, insideSection)
        }
      } else if (child.childIds.length > 0) {
        this.walkChildren(graph, childId, ax, ay, insideSection)
      }
    }
  }
}
