import {
  fitEnclosingGroups,
  WHITE,
  type SceneGraph,
  type SceneNode
} from '@open-pencil/scene-graph'
import type { Size } from '@open-pencil/scene-graph/primitives'

import { BLACK } from '#core/constants'
import type { SVGElementLayer } from '#core/icons/types'
import { createPlacedVector, vectorizedPathPaints } from '#core/vector/vectorize/placement'
import {
  svgToVectorPaths,
  type SVGVectorizeResult,
  type VectorizedClip,
  type VectorizedPath
} from '#core/vector/vectorize/svg/to-vectors'

import { parseSVGSize, svgRootId } from './metadata'

export type SVGImportData = SVGVectorizeResult &
  Size & {
    /** The root `<svg>` element's `id`, which names the imported layer. */
    name: string | null
    /** Without a width, height, or viewBox the SVG has no frame, only a group of its layers. */
    sized: boolean
  }

export interface SVGImportOptions {
  name?: string
  defaultColor?: string
  x?: number
  y?: number
}

export function prepareSVGImport(
  source: string,
  options: Pick<SVGImportOptions, 'defaultColor'> = {}
): SVGImportData | null {
  const sized = parseSVGSize(source, { width: 0, height: 0 }).width > 0
  const { width, height } = parseSVGSize(source)
  const vectorized = svgToVectorPaths(
    source,
    { width, height },
    {
      defaultColor: options.defaultColor,
      preserveAspectRatio: true
    }
  )
  return vectorized ? { width, height, name: svgRootId(source), sized, ...vectorized } : null
}

function createGroup(graph: SceneGraph, parentId: string, props: Partial<SceneNode>): string {
  return graph.createNode('GROUP', parentId, { x: 0, y: 0, ...props }).id
}

/** Figma's clip wrapper: a mask group drawn from the clip's shapes, then the clipped content. */
function createClipGroup(
  graph: SceneGraph,
  parentId: string,
  clip: VectorizedClip,
  parentIds: Set<string>
): string {
  const groupId = createGroup(graph, parentId, { name: 'Clip path group' })
  const maskId = createGroup(graph, groupId, { name: clip.id, isMask: true, maskType: 'VECTOR' })
  for (const shape of clip.shapes) {
    createPlacedVector(graph, maskId, shape, {
      name: 'Vector',
      fills: [{ type: 'SOLID', color: BLACK, opacity: 1, visible: true }]
    })
  }
  parentIds.add(maskId)
  return groupId
}

function clipFor(path: VectorizedPath, element: SVGElementLayer): VectorizedClip | null {
  return element.clip === null ? null : (path.clips?.[element.clip] ?? null)
}

/**
 * Builds the layers Figma makes from SVG: a group per `<g>`, a vector per shape, each named by
 * its `id`, and a clip group around anything clipped. Groups are fitted to their layers last.
 */
function createSVGLayers(graph: SceneGraph, rootId: string, data: SVGImportData): void {
  const open: Array<{ key: number; parentId: string }> = []
  const parentIds = new Set<string>()
  for (const path of data.paths) {
    const groups = path.elements.slice(0, -1)
    const shape = path.elements.at(-1)
    if (!shape) continue
    let depth = 0
    while (depth < open.length && depth < groups.length && open[depth].key === groups[depth].key) {
      depth++
    }
    open.length = depth
    let parentId = open.at(-1)?.parentId ?? rootId
    for (const element of groups.slice(depth)) {
      const clip = clipFor(path, element)
      if (clip) parentId = createClipGroup(graph, parentId, clip, parentIds)
      parentId = createGroup(graph, parentId, {
        name: element.name ?? 'Group',
        opacity: element.opacity
      })
      open.push({ key: element.key, parentId })
    }
    const clip = clipFor(path, shape)
    const vectorParentId = clip ? createClipGroup(graph, parentId, clip, parentIds) : parentId
    const vector = createPlacedVector(graph, vectorParentId, path.vectorNetwork, {
      name: shape.name ?? 'Vector',
      opacity: shape.opacity,
      ...vectorizedPathPaints(path)
    })
    if (vector) parentIds.add(vectorParentId)
  }
  fitEnclosingGroups(graph, [...parentIds])
}

export function createSVGNodesFromImport(
  graph: SceneGraph,
  parentId: string,
  data: SVGImportData,
  options: SVGImportOptions = {}
): SceneNode | null {
  const position = { x: options.x ?? 0, y: options.y ?? 0 }
  const root = data.sized
    ? graph.createNode('FRAME', parentId, {
        name: options.name ?? data.name ?? 'Frame',
        ...position,
        width: data.width,
        height: data.height,
        fills: [{ type: 'SOLID', color: WHITE, opacity: 1, visible: true }],
        clipsContent: true
      })
    : graph.createNode('GROUP', parentId, {
        name: options.name ?? data.name ?? 'Group',
        ...position
      })

  try {
    createSVGLayers(graph, root.id, data)
    const created = graph.getNode(root.id)
    if (created && graph.getChildren(root.id).length > 0) return created
    if (created) graph.deleteNode(root.id)
    return null
  } catch (error) {
    graph.deleteNode(root.id)
    throw error
  }
}

export function createSVGNodes(
  graph: SceneGraph,
  parentId: string,
  source: string,
  options: SVGImportOptions = {}
): SceneNode | null {
  const data = prepareSVGImport(source, options)
  return data ? createSVGNodesFromImport(graph, parentId, data, options) : null
}
