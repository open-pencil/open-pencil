import type { SceneGraph, SceneNode } from '@open-pencil/scene-graph'

export function expectDefined<T>(value: T | null | undefined, label = 'value'): NonNullable<T> {
  if (value == null) {
    throw new Error(`${label} was expected to be defined`)
  }
  return value
}

export function getNodeOrThrow(graph: SceneGraph, id: string): SceneNode {
  return expectDefined(graph.getNode(id), `node ${id}`)
}
