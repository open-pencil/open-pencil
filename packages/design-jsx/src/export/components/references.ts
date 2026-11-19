import { refName } from '#design-jsx/refs'
import { countBy } from 'es-toolkit'

import type { SceneGraph, SceneNode } from '@open-pencil/scene-graph'

import { Reference, type JSXValue } from '../value'

/**
 * How an export names a component, as `of` and swap properties take it: by the `ref()` the
 * export declares for it, by its name where no other component has it, else by its ID.
 */
export interface ComponentReference {
  of: (component: SceneNode) => JSXValue
}

function isComponent(node: SceneNode): boolean {
  return node.type === 'COMPONENT' || node.type === 'COMPONENT_SET'
}

/**
 * Names `of` and swap properties resolve in this graph and in another that has the same
 * components.
 * A component the export writes is named by the ref `refs` gives it, so its instances find the
 * copy rendered with them, not a component the target already has by that name; `onOf` hears
 * of each component named. Otherwise a name two components share is written as the
 * component's ID, which only this graph has. The graph is read once, on the first reference.
 */
export function componentReferences(
  graph: SceneGraph,
  refs: ReadonlyMap<string, string | null> = new Map(),
  onOf?: (component: SceneNode) => void
): ComponentReference {
  let names: Record<string, number> | undefined
  const name = (component: SceneNode) => {
    names ??= countBy([...graph.getAllNodes()].filter(isComponent), (node) => node.name)
    return component.name && names[component.name] === 1 ? component.name : component.id
  }
  return {
    of: (component) => {
      onOf?.(component)
      const ref = refs.get(component.id)
      return ref ? new Reference(ref) : name(component)
    }
  }
}

/**
 * The refs an export declares: `connectorRefs`, and one for each component in `named` that it
 * writes, named apart from the names in `taken`. A layer both need takes one ref.
 */
export function componentRefs(
  graph: SceneGraph,
  named: Iterable<string>,
  connectorRefs: ReadonlyMap<string, string | null>,
  taken: Set<string>
): ReadonlyMap<string, string | null> {
  const refs = new Map(connectorRefs)
  for (const id of named) {
    const component = graph.getNode(id)
    if (component && !refs.get(id) && isComponent(component))
      refs.set(id, refName(component.name, taken))
  }
  return refs
}
