import type { SceneGraph } from '../index'
import { hasInstanceOverride } from '../instances'
import type { SceneNode } from '../types'
import { NUMERIC_FIELDS, isNumericVariableBindingField } from './fields'
export { isNumericVariableBindingField } from './fields'

/** New declarations belong to the outermost occurrence, bounded by a component definition. */
export function variableBindingOwner(graph: SceneGraph, node: SceneNode): SceneNode {
  let owner = node
  let current: SceneNode | undefined = node
  while (current) {
    if (current.type === 'COMPONENT' || current.type === 'COMPONENT_SET') break
    if (current.type === 'INSTANCE') owner = current
    current = current.parentId ? graph.getNode(current.parentId) : undefined
  }
  return owner
}

export function assignVariableBindingUnits(
  graph: SceneGraph,
  node: SceneNode,
  field: string
): void {
  if (!isNumericVariableBindingField(field)) return
  const owner = variableBindingOwner(graph, node)
  node.variableBindingScales = {
    ...node.variableBindingScales,
    [field]: owner.variableAssignmentScales[field] ?? 1
  }
}

/** Resolve live numeric bindings in scene units, without authoring instance overrides. */
export function reconcileNumericVariableBindings(graph: SceneGraph): string[] {
  const changed: string[] = []
  for (const node of graph.getAllNodes()) {
    const updates: Partial<SceneNode> = {}
    for (const [field, variableId] of Object.entries(node.boundVariables)) {
      if (!NUMERIC_FIELDS.has(field)) continue
      if ((field === 'width' || field === 'height') && hasInstanceOverride(graph, node.id, field))
        continue
      const value = graph.resolveNumberVariableForNode(node.id, variableId)
      if (value === undefined || !Number.isFinite(value)) continue
      const scale = node.variableBindingScales[field] ?? 1
      const effective = value * scale
      if (!Number.isFinite(effective)) continue
      const next = field === 'opacity' ? Math.max(0, Math.min(1, effective)) : effective
      if (node[field as keyof SceneNode] !== next) Object.assign(updates, { [field]: next })
    }
    if (Object.keys(updates).length === 0) continue
    graph.updateNode(node.id, updates)
    changed.push(node.id)
  }
  return changed
}
