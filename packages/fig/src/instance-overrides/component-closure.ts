import type { NodeChange } from '@open-pencil/kiwi/fig/codec'
import type { SceneGraph } from '@open-pencil/scene-graph'

import {
  createOccurrenceInterpreter,
  type InstanceOccurrence,
  type InterpretInstanceOptions
} from './interpret'
import { materializeInstance } from './materialize-instance'
import {
  linkInstanceSourceChildren,
  mapInstanceSourceChildren,
  type MaterializedComponentOccurrence
} from './source-children'

/** Build only the component definitions required by an interpreted occurrence. */
export function materializeComponentClosure(
  graph: SceneGraph,
  parentId: string,
  changes: readonly NodeChange[],
  root: InstanceOccurrence,
  blobs: Uint8Array[] = [],
  options: InterpretInstanceOptions = {}
): ReadonlyMap<string, MaterializedComponentOccurrence> {
  const interpreter = createOccurrenceInterpreter(changes)
  const components = new Map<string, MaterializedComponentOccurrence>()
  const ids = new Map<string, string>()
  const pending = new Set<string>()
  const visit = (occurrence: InstanceOccurrence): void => {
    if (occurrence.mainComponentId !== null) ensure(occurrence.mainComponentId)
    for (const child of occurrence.children) visit(child)
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
  return components
}
