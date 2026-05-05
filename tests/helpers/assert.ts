import type { SceneGraph, SceneNode } from '@open-pencil/core'

export function expectDefined<T>(value: T | null | undefined, label = 'value'): NonNullable<T> {
  if (value == null) {
    throw new Error(`${label} was expected to be defined`)
  }
  return value
}

export function getNodeOrThrow(graph: SceneGraph, id: string): SceneNode {
  return expectDefined(graph.getNode(id), `node ${id}`)
}

export function childIdAt(node: SceneNode, index: number): string {
  return expectDefined(node.childIds[index], `child ${index} of ${node.id}`)
}
