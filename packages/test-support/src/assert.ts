/**
 * Assertions that narrow a value for the rest of a test. Typed structurally rather than against
 * Scene Graph, so Scene Graph's own tests use them without a dependency cycle.
 */

export function expectDefined<T>(value: T | null | undefined, label = 'value'): NonNullable<T> {
  if (value == null) {
    throw new Error(`${label} was expected to be defined`)
  }
  return value
}

/** A graph's node by id, failing the test when it is missing. */
export function getNodeOrThrow<T>(
  graph: { getNode(id: string): T | null | undefined },
  id: string
): NonNullable<T> {
  return expectDefined(graph.getNode(id), `node ${id}`)
}

/** The id of a node's child at `index`, failing the test when there is none. */
export function childIdAt(
  node: { id: string; childIds: readonly string[] },
  index: number
): string {
  return expectDefined(node.childIds[index], `child ${index} of ${node.id}`)
}

/** A script-visible node's fills, failing when they read `figma.mixed`, as differently filled text does. */
export function expectFills<T>(fills: readonly T[] | symbol, label = 'fills'): readonly T[] {
  if (typeof fills === 'symbol')
    throw new Error(`${label} were expected to be one value, not mixed`)
  return fills
}
