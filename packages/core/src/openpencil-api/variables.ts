import type { SceneGraph } from '@open-pencil/scene-graph'
import { paintBindingTarget, resolvedPaintBindings } from '@open-pencil/scene-graph/variables'

import { reconcileVariableLayouts } from '#core/layout/variables'

import { nodeOf, type NodeRef } from './behaviours'

/** A variable as `figma` hands it out, such as from `figma.variables.getLocalVariables()`. */
export type VariableRef = { readonly id: string }

function variableOf(graph: SceneGraph, ref: VariableRef) {
  const variable = graph.variables.get(ref.id)
  if (!variable) throw new Error(`No variable ${ref.id}`)
  return variable
}

/**
 * Binds a layer field to a variable as the layer panel does, which takes more than Figma's
 * `setBoundVariable`: text content a text or number variable, visibility a boolean or text one.
 */
export function bindVariable(
  graph: SceneGraph,
  node: NodeRef,
  field: string,
  variable: VariableRef
): void {
  const target = nodeOf(graph, node)
  graph.bindVariable(target.id, field, variableOf(graph, variable).id)
  reconcileVariableLayouts(graph, { subtrees: [target.id] })
}

/** Lets a layer field go of its variable; the field keeps the value the variable last gave it. */
export function unbindVariable(graph: SceneGraph, node: NodeRef, field: string): void {
  const target = nodeOf(graph, node)
  if (!(field in target.boundVariables))
    throw new Error(`${target.name} has no variable bound to ${field}`)
  // A paint keeps the color its variable last gave it, as values do and as Figma's detach does.
  if (paintBindingTarget(field)) graph.updateNode(target.id, resolvedPaintBindings(graph, target))
  graph.unbindVariable(target.id, field)
  reconcileVariableLayouts(graph, { subtrees: [target.id] })
}
