import type { SceneNode } from '@open-pencil/scene-graph'

import { newLayerDefaults } from '#core/editor/shapes/defaults'

/**
 * Whether making a component from this layer turns the layer itself into the component. Figma
 * converts a frame or a group in place, from the canvas and from the plugin API, and wraps any
 * other layer.
 */
export function becomesComponent(node: SceneNode): boolean {
  return node.type === 'FRAME' || node.type === 'GROUP'
}

/** Look of a component wrapped around layers: white like a new component, named after one layer. */
export function componentWrapProps(nodes: readonly SceneNode[]): Partial<SceneNode> {
  return {
    ...newLayerDefaults('COMPONENT'),
    ...(nodes.length === 1 ? { name: nodes[0].name } : {})
  }
}
