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

/** A script-visible node's fills, failing when they read `figma.mixed`, as differently filled text does. */
export function expectFills<T>(fills: readonly T[] | symbol, label = 'fills'): readonly T[] {
  if (typeof fills === 'symbol') throw new Error(`${label} were expected to be one value, not mixed`)
  return fills
}
