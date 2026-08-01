import type { SceneGraph, SceneNode } from '@open-pencil/scene-graph'
import type { Size } from '@open-pencil/scene-graph/primitives'

import { createFlattenedVectorFrameChildren } from '#core/vector/vectorize/placement'
import { svgToVectorPaths, type SVGVectorizeResult } from '#core/vector/vectorize/svg/to-vectors'

import { parseSVGSize } from './metadata'

export type SVGImportData = SVGVectorizeResult & Size

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
  const { width, height } = parseSVGSize(source)
  const vectorized = svgToVectorPaths(
    source,
    { width, height },
    {
      defaultColor: options.defaultColor,
      preserveAspectRatio: true
    }
  )
  return vectorized ? { width, height, ...vectorized } : null
}

export function createSVGNodesFromImport(
  graph: SceneGraph,
  parentId: string,
  data: SVGImportData,
  options: SVGImportOptions = {}
): SceneNode | null {
  const frame = graph.createNode('FRAME', parentId, {
    name: options.name ?? 'SVG',
    x: options.x ?? 0,
    y: options.y ?? 0,
    width: data.width,
    height: data.height,
    fills: []
  })

  try {
    createFlattenedVectorFrameChildren(graph, frame.id, data, {
      x: frame.x,
      y: frame.y,
      width: frame.width,
      height: frame.height,
      offsetX: 0,
      offsetY: 0
    })
    if (graph.getChildren(frame.id).length > 0) return frame
    graph.deleteNode(frame.id)
    return null
  } catch (error) {
    graph.deleteNode(frame.id)
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
