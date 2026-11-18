import type { NodeChange } from '@open-pencil/kiwi/fig/codec'
import { guidToString } from '@open-pencil/kiwi/fig/guid'

import { assignmentValue, bindSourceProperties, componentBindings } from './bindings/properties'
import { idOf, parentIdOf, type SourceIndex } from './source-index'
import { symbolOverridesOf, type ComponentPropAssignment } from './types'

/** The document's outermost record, found by following parents up from any record. */
function rootOf({ sources }: SourceIndex): string | undefined {
  const seen = new Set<string>()
  let current: string | undefined = sources.keys().next().value
  while (current !== undefined && !seen.has(current)) {
    seen.add(current)
    const record = sources.get(current)
    const parent = record && parentIdOf(record)
    if (parent === undefined || !sources.has(parent)) return current
    current = parent
  }
  return undefined
}

/**
 * A record's descendants in layer order. A descendant `skip` turns down, even once it has been
 * yielded, keeps its own descendants out.
 */
function* layerOrder(
  children: SourceIndex['children'],
  id: string,
  skip: (record: NodeChange) => boolean = () => false
): Generator<NodeChange> {
  for (const child of children.get(id) ?? []) {
    if (skip(child)) continue
    yield child
    const childId = idOf(child)
    if (childId !== undefined && !skip(child)) yield* layerOrder(children, childId, skip)
  }
}

/**
 * The components an instance in a definition leads to: the one it shows, with the definition's
 * property defaults applied, and those its own swaps and swap property values put in its layers.
 */
function instanceTargets(instance: NodeChange, definition: NodeChange): string[] {
  const shown = bindSourceProperties(instance, componentBindings(definition)).symbolData?.symbolID
  const swaps = symbolOverridesOf(instance).flatMap((override) =>
    override.overriddenSymbolID ? [override.overriddenSymbolID] : []
  )
  const assigned = ((instance.componentPropAssignments ?? []) as ComponentPropAssignment[]).flatMap(
    (assignment) => {
      const value = assignmentValue(assignment)?.guidValue
      return value ? [value] : []
    }
  )
  return [...(shown ? [shown] : []), ...swaps, ...assigned].map(guidToString)
}

/**
 * Instances a document cannot hold because their component would contain itself, which Figma
 * drops as it opens or pastes the records. Figma walks component definitions depth first, in
 * layer order across the document, and drops an instance in a definition that leads back to a
 * definition still being walked: by the component it shows, a swap it makes, or a swap property
 * value it assigns. Which instance goes depends on that order, not on where a read starts, so a
 * loop loses the same instance on every page.
 */
export function findCyclicInstances(index: SourceIndex): Set<string> {
  const { sources } = index
  const dropped = new Set<string>()
  const state = new Map<string, 'walking' | 'done'>()
  const isComponent = (id: string): boolean => sources.get(id)?.type === 'SYMBOL'
  const walk = (componentId: string): void => {
    const definition = sources.get(componentId)
    if (!definition) return
    state.set(componentId, 'walking')
    const instances = layerOrder(index.children, componentId, (record) => {
      const id = idOf(record)
      return id !== undefined && dropped.has(id)
    })
    for (const record of instances) {
      const id = idOf(record)
      if (record.type !== 'INSTANCE' || id === undefined) continue
      for (const target of instanceTargets(record, definition)) {
        if (!isComponent(target)) continue
        if (state.get(target) === 'walking') {
          dropped.add(id)
          break
        }
        if (!state.has(target)) walk(target)
      }
    }
    state.set(componentId, 'done')
  }
  const root = rootOf(index)
  if (root === undefined) return dropped
  for (const record of layerOrder(index.children, root)) {
    const id = idOf(record)
    if (record.type === 'SYMBOL' && id !== undefined && !state.has(id)) walk(id)
  }
  return dropped
}
