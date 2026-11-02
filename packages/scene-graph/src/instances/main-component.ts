import type { SceneGraph } from '../graph'
import type { SceneNode } from '../types'
import { paintBindingTarget } from '../variables/fields'
import { overriddenBindingField } from './overrides'

/**
 * The main component an instance shows. An instance nested in another instance points at the
 * instance it was cloned from, so follow those links to the component.
 */
export function instanceMainComponent(
  graph: SceneGraph,
  instance: SceneNode
): SceneNode | undefined {
  const seen = new Set<string>()
  let current = instance.componentId ? graph.getNode(instance.componentId) : undefined
  while (current?.type === 'INSTANCE' && current.componentId && !seen.has(current.id)) {
    seen.add(current.id)
    current = graph.getNode(current.componentId)
  }
  return current?.type === 'COMPONENT' ? current : undefined
}

/** Root paint claims also protect a nested copy when its enclosing component syncs it. */
export function ownsSelfFillField(target: SceneNode, field: string): boolean {
  const own = target.instanceOverrides.self
  if (field === 'fills' || field === 'fillStyleId') return own.has(field) || own.has('fills')
  // A paint the layer set itself owns its bindings too, bound or not.
  const binding = overriddenBindingField(field)
  return (
    binding !== null &&
    paintBindingTarget(binding)?.list === 'fills' &&
    (own.has(field) || own.has('boundVariables') || own.has('fills'))
  )
}

/** A swapped nested root takes its fill from what it shows, not its template's old component. */
export function sourceWithEffectiveFill(
  graph: SceneGraph,
  source: SceneNode,
  target: SceneNode
): SceneNode {
  if (source.type !== 'INSTANCE' || target.type !== 'INSTANCE') return source
  const original = instanceMainComponent(graph, source)
  const effective = instanceMainComponent(graph, target)
  if (!original || !effective || original.id === effective.id) return source
  const fillBindings = <T>(from: Record<string, T>, to: Record<string, T>): Record<string, T> =>
    Object.fromEntries([
      ...Object.entries(from).filter(([key]) => !key.startsWith('fills/')),
      ...Object.entries(to).filter(([key]) => key.startsWith('fills/'))
    ])
  return {
    ...source,
    fills: effective.fills,
    fillStyleId: effective.fillStyleId,
    boundVariables: fillBindings(source.boundVariables, effective.boundVariables),
    variableBindingScales: fillBindings(
      source.variableBindingScales,
      effective.variableBindingScales
    )
  }
}
