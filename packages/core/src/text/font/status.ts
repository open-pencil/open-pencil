import type { SceneGraph, SceneNode } from '@open-pencil/scene-graph'

import { DEFAULT_FONT_FAMILY } from '#core/constants'
import type { FontLoadedSource, FontUnavailableReason } from '#core/text/font/sources'
import { fontManager, type FontManager } from '#core/text/fonts'
import { collectNodeFontFaces } from '#core/text/requirements'

export type FontFaceStatus = 'available' | 'substituted' | 'unresolved'

export interface DocumentFontFaceStatus {
  family: string
  style: string
  status: FontFaceStatus
  source: FontLoadedSource | null
  substituteFamily: string | null
  /** Why the requested face could not be loaded, when the host reported a reason. */
  reason: FontUnavailableReason | null
  nodeIds: string[]
  nodeNames: string[]
}

export interface DocumentFontStatus {
  faithful: boolean
  faces: DocumentFontFaceStatus[]
  issues: DocumentFontFaceStatus[]
}

interface MutableFontFaceUse {
  family: string
  style: string
  nodeIds: Set<string>
  nodeNames: Set<string>
}

function faceKey(family: string, style: string): string {
  return `${family}\0${style}`
}

/** The text nodes under each root, and each root that is itself text. */
function rootTextNodes(graph: SceneGraph, rootIds: readonly string[]): SceneNode[] {
  const texts: SceneNode[] = []
  const stack = [...rootIds]
  while (stack.length > 0) {
    const node = graph.getNode(stack.pop() ?? '')
    if (!node) continue
    if (node.type === 'TEXT') texts.push(node)
    for (const childId of node.childIds) stack.push(childId)
  }
  return texts
}

type TextFontFaces = { name: string; faces: Array<{ family: string; style: string }> }

/**
 * The faces each text under the roots uses, kept by layer: a status is read from the layers
 * as they are, and an edit updates the one layer it touched, so a page of tens of thousands of
 * layers is walked once rather than at every keystroke.
 */
export class DocumentFontUses {
  private readonly byNode = new Map<string, TextFontFaces>()
  private readonly roots: readonly string[]

  constructor(
    private readonly graph: SceneGraph,
    rootIds: string | readonly string[]
  ) {
    this.roots = typeof rootIds === 'string' ? [rootIds] : rootIds
    for (const node of rootTextNodes(graph, this.roots)) this.remember(node)
  }

  /** `nodeId` changed, arrived, or moved: its faces are read again, if it is text under a root. */
  update(nodeId: string): void {
    const node = this.graph.getNode(nodeId)
    if (node?.type !== 'TEXT' || !this.underRoots(nodeId)) {
      this.byNode.delete(nodeId)
      return
    }
    this.remember(node)
  }

  /** `nodeId` left the document, with whatever was under it. */
  remove(nodeId: string): void {
    this.byNode.delete(nodeId)
  }

  status(manager: FontManager = fontManager): DocumentFontStatus {
    const uses = new Map<string, MutableFontFaceUse>()
    for (const [nodeId, { name, faces }] of this.byNode) {
      // A layer deleted under a deleted ancestor reported nothing itself; it is skipped here.
      if (!this.graph.getNode(nodeId)) continue
      for (const { family, style } of faces) {
        const key = faceKey(family, style)
        const use = uses.get(key) ?? {
          family,
          style,
          nodeIds: new Set<string>(),
          nodeNames: new Set<string>()
        }
        use.nodeIds.add(nodeId)
        use.nodeNames.add(name)
        uses.set(key, use)
      }
    }
    const faces = [...uses.values()]
      .map((use) => faceStatus(use, manager))
      .sort((a, b) => a.family.localeCompare(b.family) || a.style.localeCompare(b.style))
    const issues = faces.filter((face) => face.status !== 'available')
    return { faithful: issues.length === 0, faces, issues }
  }

  private remember(node: SceneNode): void {
    this.byNode.set(node.id, { name: node.name, faces: collectNodeFontFaces(node) })
  }

  private underRoots(nodeId: string): boolean {
    let current: string | null = nodeId
    while (current) {
      if (this.roots.includes(current)) return true
      current = this.graph.getNode(current)?.parentId ?? null
    }
    return false
  }
}

function faceStatus(use: MutableFontFaceUse, manager: FontManager): DocumentFontFaceStatus {
  const exactSource = manager.loadedFontSource(use.family, use.style)
  if (exactSource) {
    return {
      family: use.family,
      style: use.style,
      status: 'available',
      source: exactSource,
      substituteFamily: null,
      reason: null,
      nodeIds: [...use.nodeIds],
      nodeNames: [...use.nodeNames]
    }
  }

  if (manager.isLoaded(use.family)) {
    return {
      family: use.family,
      style: use.style,
      status: 'substituted',
      source: null,
      substituteFamily: use.family,
      reason: manager.unavailableReason(use.family, use.style),
      nodeIds: [...use.nodeIds],
      nodeNames: [...use.nodeNames]
    }
  }

  const defaultSource = manager.loadedFontSource(DEFAULT_FONT_FAMILY, 'Regular')
  return {
    family: use.family,
    style: use.style,
    status: defaultSource ? 'substituted' : 'unresolved',
    source: null,
    substituteFamily: defaultSource ? DEFAULT_FONT_FAMILY : null,
    reason: manager.unavailableReason(use.family, use.style),
    nodeIds: [...use.nodeIds],
    nodeNames: [...use.nodeNames]
  }
}

export function documentFontStatus(
  graph: SceneGraph,
  rootIds: string | readonly string[],
  manager: FontManager = fontManager
): DocumentFontStatus {
  return new DocumentFontUses(graph, rootIds).status(manager)
}
