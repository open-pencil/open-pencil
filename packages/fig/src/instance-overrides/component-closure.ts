import type { NodeChange } from '@open-pencil/kiwi/fig/codec'
import type { SceneGraph } from '@open-pencil/scene-graph'

import { componentDependencies } from '../document/component/dependencies'
import { linkComponentPropertyValues } from '../document/component/values'
import { createResourceResolver } from '../document/resource-reference'
import {
  createOccurrenceInterpreter,
  type InstanceOccurrence,
  type InterpretInstanceOptions
} from './interpret'
import { materializeInstance } from './materialize-instance'
import { occurrences } from './occurrence-path'
import {
  linkInstanceSourceChildren,
  mapInstanceSourceChildren,
  type MaterializedComponentOccurrence
} from './source-children'

export interface MaterializedComponentClosure extends ReadonlyMap<
  string,
  MaterializedComponentOccurrence
> {
  /** Unavailable preferred choices remain external keys, not required source dependencies. */
  readonly externalPreferredKeys: ReadonlySet<string>
}

/** Build effective components and inactive property dependencies needed for later edits. */
export function materializeComponentClosure(
  graph: SceneGraph,
  parentId: string,
  changes: readonly NodeChange[],
  root: InstanceOccurrence,
  blobs: Uint8Array[] = [],
  options: InterpretInstanceOptions = {}
): MaterializedComponentClosure {
  const interpreter = createOccurrenceInterpreter(changes)
  const existingNodeIds = new Set(graph.nodes.keys())
  const resolveReference = createResourceResolver(changes)
  const externalPreferredKeys = new Set<string>()
  const propertyDependencies = new Set<string>()
  const components = new Map<string, MaterializedComponentOccurrence>()
  const ids = new Map<string, string>()
  const pending = new Set<string>()
  const visit = (root: InstanceOccurrence): void => {
    for (const occurrence of occurrences(root)) {
      for (const dependency of componentDependencies(
        occurrence.properties,
        resolveReference,
        (key) => externalPreferredKeys.add(key)
      ))
        propertyDependencies.add(dependency)
      if (occurrence.mainComponentId !== null) ensure(occurrence.mainComponentId)
    }
  }
  const ensure = (id: string): void => {
    if (components.has(id)) return
    if (pending.has(id)) throw new Error(`Cyclic component dependency ${id}`)
    pending.add(id)
    const occurrence = interpreter.component(id, options)
    visit(occurrence)
    const materialized = materializeInstance(
      graph,
      parentId,
      occurrence,
      ids,
      blobs,
      mapInstanceSourceChildren(occurrence, components)
    )
    linkInstanceSourceChildren(occurrence, materialized, components)
    components.set(id, { occurrence, materialized })
    ids.set(id, materialized.root.id)
    pending.delete(id)
  }
  visit(root)
  // A property default can point back to its own definition without forming a cyclic
  // occurrence tree. Drain these edges after effective expansion, not on its call stack.
  for (const dependency of propertyDependencies) ensure(dependency)
  const materialized = [...graph.nodes.values()].filter((node) => !existingNodeIds.has(node.id))
  linkComponentPropertyValues(graph, ids, materialized)
  return Object.assign(components, { externalPreferredKeys })
}
