import type { SceneGraph, SceneNode } from '@open-pencil/scene-graph'

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

export interface CachedFrame {
  nodeId: string
  absX: number
  absY: number
}

interface Viewport {
  x: number
  y: number
  w: number
  h: number
}

const LABEL_TYPES = new Set(['COMPONENT', 'COMPONENT_SET'])
const COMPONENT_LABEL_PARENT_TYPES = new Set(['CANVAS', 'SECTION'])
const FRAME_TITLE_PARENT_TYPES = new Set(['CANVAS', 'SECTION'])

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
  private frames: CachedFrame[] = []
  private cachedSceneVersion = -1
  private cachedPositionPreviewVersion = -1
  private cachedPageId: string | null = null
  private cachedEnteredContainerId: string | null | undefined = undefined

  update(
    graph: SceneGraph,
    pageId: string | null,
    sceneVersion: number,
    positionPreviewVersion = graph.positionPreviewVersion,
    enteredContainerId?: string | null
  ): void {
    if (
      sceneVersion === this.cachedSceneVersion &&
      positionPreviewVersion === this.cachedPositionPreviewVersion &&
      pageId === this.cachedPageId &&
      enteredContainerId === this.cachedEnteredContainerId
    ) {
      return
    }
    this.rebuild(graph, pageId, enteredContainerId)
    this.cachedSceneVersion = sceneVersion
    this.cachedPositionPreviewVersion = positionPreviewVersion
    this.cachedPageId = pageId
    this.cachedEnteredContainerId = enteredContainerId
  }

  invalidate(): void {
    this.cachedSceneVersion = -1
    this.cachedPositionPreviewVersion = -1
    this.cachedPageId = null
    this.cachedEnteredContainerId = undefined
    this.sections = []
    this.components = []
    this.frames = []
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
    return collectVisibleLabels(graph, viewport, this.components, () => ({
      inside: false
    }))
  }

  getFrames(
    graph: SceneGraph,
    viewport: Viewport
  ): Array<{ node: SceneNode; absX: number; absY: number }> {
    return collectVisibleLabels(graph, viewport, this.frames, () => ({}))
  }

  getAllFrames(): readonly CachedFrame[] {
    return this.frames
  }

  getAllSections(): readonly CachedSection[] {
    return this.sections
  }

  getAllComponents(): readonly CachedComponent[] {
    return this.components
  }

  private rebuild(
    graph: SceneGraph,
    pageId: string | null,
    enteredContainerId?: string | null
  ): void {
    this.sections = []
    this.components = []
    this.frames = []

    const pageNode = graph.getNode(pageId ?? graph.rootId)
    if (pageNode) {
      this.walkChildren(graph, pageNode.id, 0, 0, false, false, enteredContainerId)
    }
  }

  private walkChildren(
    graph: SceneGraph,
    parentId: string,
    ox: number,
    oy: number,
    insideSection: boolean,
    collectNestedFrames = false,
    enteredContainerId?: string | null
  ): void {
    const parent = graph.getNode(parentId)
    if (!parent) return
    const parentType = parent.type
    const shouldCollectNested = collectNestedFrames || parentId === enteredContainerId

    for (const childId of parent.childIds) {
      const child = graph.getNode(childId)
      if (!child || !child.visible) continue
      const ax = ox + child.x
      const ay = oy + child.y

      if (child.type === 'SECTION') {
        this.sections.push({ nodeId: childId, absX: ax, absY: ay, nested: insideSection })
        this.walkChildren(graph, childId, ax, ay, true, shouldCollectNested, enteredContainerId)
      } else if (
        child.type === 'FRAME' &&
        (FRAME_TITLE_PARENT_TYPES.has(parentType) || shouldCollectNested)
      ) {
        this.frames.push({ nodeId: childId, absX: ax, absY: ay })
        this.walkChildren(
          graph,
          childId,
          ax,
          ay,
          insideSection,
          shouldCollectNested,
          enteredContainerId
        )
      } else if (LABEL_TYPES.has(child.type)) {
        if (COMPONENT_LABEL_PARENT_TYPES.has(parentType)) {
          this.components.push({ nodeId: childId, absX: ax, absY: ay, parentType })
        }
        if (child.childIds.length > 0) {
          this.walkChildren(
            graph,
            childId,
            ax,
            ay,
            insideSection,
            shouldCollectNested,
            enteredContainerId
          )
        }
      } else if (child.childIds.length > 0) {
        this.walkChildren(
          graph,
          childId,
          ax,
          ay,
          insideSection,
          shouldCollectNested,
          enteredContainerId
        )
      }
    }
  }
}
