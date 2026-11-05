import { SceneGraph, type SceneNode } from '@open-pencil/scene-graph'
import { computeImageHash } from '@open-pencil/scene-graph/images'
import type { Color } from '@open-pencil/scene-graph/primitives'

/** A fill that shows, so a shape takes clicks and hover as a drawn one does in Figma. */
export const SOLID_FILL = {
  type: 'SOLID' as const,
  color: { r: 0.8, g: 0.8, b: 0.8, a: 1 },
  opacity: 1,
  visible: true
}

export function makeSceneGraph(pageName = 'Test'): SceneGraph {
  const graph = new SceneGraph()
  graph.addPage(pageName)
  return graph
}

export function firstPageId(graph: SceneGraph): string {
  return graph.getPages()[0].id
}

/** Stores `bytes` as an image under their hash, whatever they encode, and returns the hash. */
export function storeImageBytes(graph: SceneGraph, bytes: Uint8Array): string {
  const hash = computeImageHash(bytes)
  graph.images.set(hash, bytes)
  return hash
}

export function addTestColorVariable(
  graph: SceneGraph,
  id: string,
  name: string,
  value: Color = { r: 1, g: 1, b: 1, a: 1 }
): void {
  if (!graph.variableCollections.has('colors')) {
    graph.addCollection({
      id: 'colors',
      name: 'Colors',
      modes: [{ modeId: 'light', name: 'Light' }],
      defaultModeId: 'light',
      variableIds: []
    })
  }

  graph.addVariable({
    id,
    name,
    type: 'COLOR',
    collectionId: 'colors',
    valuesByMode: { light: value },
    description: '',
    hiddenFromPublishing: false
  })
}

export function createRect(
  graph: SceneGraph,
  parentId: string,
  props: { name?: string; x?: number; y?: number; width?: number; height?: number } = {}
): SceneNode {
  return graph.createNode('RECTANGLE', parentId, {
    name: props.name ?? 'Rect',
    x: props.x ?? 0,
    y: props.y ?? 0,
    width: props.width ?? 50,
    height: props.height ?? 50
  })
}
