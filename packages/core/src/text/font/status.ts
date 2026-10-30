import type { SceneGraph, SceneNode } from '@open-pencil/scene-graph'

import { DEFAULT_FONT_FAMILY } from '#core/constants'
import { fontManager, type FontManager } from '#core/text/font/manager'
import { collectNamedNodeFontFaces } from '#core/text/font/names'
import type { FontLoadedSource, FontUnavailableReason } from '#core/text/font/sources'

export type FontFaceStatus = 'available' | 'substituted' | 'unresolved'

export interface DocumentFontFaceStatus {
  family: string
  /** The style the font manager loads the face as. */
  style: string
  /** The face's name, as its text names it ("Book", "Semi Bold"). */
  name: string
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
  name: string
  nodeIds: Set<string>
  nodeNames: Set<string>
}

/** A face by its name and the style it loads as; one name may load as two styles. */
function faceKey(family: string, style: string, name: string): string {
  return `${family}\0${style}\0${name}`
}

/** The text nodes under each root, and each root that is itself text. */
function rootTextNodes(graph: SceneGraph, rootIds: readonly string[]): SceneNode[] {
  return rootIds.flatMap((rootId) => {
    const root = graph.getNode(rootId)
    if (!root) return []
    const nodes = [root, ...graph.flattenTree(rootId).map(({ node }) => node)]
    return nodes.filter((node) => node.type === 'TEXT')
  })
}

function collectFaceUses(graph: SceneGraph, rootIds: readonly string[]): MutableFontFaceUse[] {
  const uses = new Map<string, MutableFontFaceUse>()
  for (const node of rootTextNodes(graph, rootIds)) {
    // Faces that load as one style ("Book" and "Roman" at 400) are still faces of their own.
    for (const { family, style, name } of collectNamedNodeFontFaces(node)) {
      const key = faceKey(family, style, name)
      const use = uses.get(key) ?? {
        family,
        style,
        name,
        nodeIds: new Set<string>(),
        nodeNames: new Set<string>()
      }
      use.nodeIds.add(node.id)
      use.nodeNames.add(node.name)
      uses.set(key, use)
    }
  }
  return [...uses.values()]
}

function faceStatus(use: MutableFontFaceUse, manager: FontManager): DocumentFontFaceStatus {
  const exactSource = manager.loadedFontSource(use.family, use.style)
  if (exactSource) {
    return {
      family: use.family,
      style: use.style,
      name: use.name,
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
      name: use.name,
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
    name: use.name,
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
  const roots = typeof rootIds === 'string' ? [rootIds] : rootIds
  const faces = collectFaceUses(graph, roots)
    .map((use) => faceStatus(use, manager))
    .sort((a, b) => a.family.localeCompare(b.family) || a.name.localeCompare(b.name))
  const issues = faces.filter((face) => face.status !== 'available')
  return { faithful: issues.length === 0, faces, issues }
}
