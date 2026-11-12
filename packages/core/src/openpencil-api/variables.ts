import type { SceneGraph } from '@open-pencil/scene-graph'

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

/** Lets a layer field go of its variable, keeping the value it holds, as Figma's detach does. */
export function unbindVariable(graph: SceneGraph, node: NodeRef, field: string): void {
  const target = nodeOf(graph, node)
  if (!(field in target.boundVariables))
    throw new Error(`${target.name} has no variable bound to ${field}`)
  graph.unbindVariable(target.id, field)
  reconcileVariableLayouts(graph, { subtrees: [target.id] })
}
