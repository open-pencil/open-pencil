import type { SceneGraph, VariableLiteral } from '@open-pencil/scene-graph'

import { isVariable } from './variables'
import { requireVariableId } from './variables/graph'
import { scalarProps } from './variables/props'

/** Resolve numeric props before sizing inference; retain real graph bindings afterward. */
export function prepareScalarBindings(
  graph: SceneGraph,
  props: Record<string, unknown>,
  bindings: Record<string, string>,
  isText: boolean,
  resolve: (variableId: string) => VariableLiteral | undefined
): void {
  const entries = scalarProps({ text: isText, grid: !!props.grid, wrap: !!props.wrap })
  const scalarBindings = new Map<string, string>()
  for (const { prop: key, fields } of entries) {
    const value = props[key]
    if (value === undefined) continue
    // A literal longhand must also override a bound shorthand on that edge.
    for (const field of fields) scalarBindings.delete(field)
    if (!isVariable(value)) continue

    const variable = graph.variables.get(requireVariableId(graph, value))
    if (variable?.type !== 'FLOAT') {
      throw new Error(`Expected a FLOAT variable for ${key}: ${value.name}`)
    }
    const resolved = resolve(variable.id)
    if (typeof resolved !== 'number' || !Number.isFinite(resolved)) {
      throw new TypeError(`Cannot resolve numeric variable for ${key}: ${value.name}`)
    }
    props[key] = resolved
    for (const field of fields) scalarBindings.set(field, variable.id)
  }
  Object.assign(bindings, Object.fromEntries(scalarBindings))
}
