import type { SceneGraph, SceneNode } from '@open-pencil/scene-graph'

import type { getNodeContext } from './helpers'
import { helperCall, type JSXProp, type JSXValue } from './value'

/** Constraints apply where a parent does not lay its children out. */
function hasConstraints(node: SceneNode, ctx: ReturnType<typeof getNodeContext>): boolean {
  return !ctx.parentIsAutoLayout || node.layoutPositioning === 'ABSOLUTE'
}

function collectConstraintProps(
  node: SceneNode,
  ctx: ReturnType<typeof getNodeContext>,
  props: JSXProp[]
): void {
  if (!hasConstraints(node, ctx)) return
  const horizontal = node.horizontalConstraint === 'MIN' ? undefined : node.horizontalConstraint
  const vertical = node.verticalConstraint === 'MIN' ? undefined : node.verticalConstraint
  if (!horizontal && !vertical) return
  props.push([
    'constraints',
    { horizontal: horizontal?.toLowerCase(), vertical: vertical?.toLowerCase() }
  ])
}

function collectSizeLimitProps(node: SceneNode, props: JSXProp[]): void {
  if (node.minWidth != null) props.push(['minW', node.minWidth])
  if (node.maxWidth != null) props.push(['maxW', node.maxWidth])
  if (node.minHeight != null) props.push(['minH', node.minHeight])
  if (node.maxHeight != null) props.push(['maxH', node.maxHeight])
}

/**
 * Variables are named when the name is unique in the document, which is how `designVar`
 * resolves them, and referenced by ID otherwise.
 */
function variableRef(graph: SceneGraph, variableId: string): JSXValue {
  const variable = graph.variables.get(variableId)
  if (!variable) return variableId
  const sameName = [...graph.variables.values()].filter((v) => v.name === variable.name)
  return sameName.length === 1 ? helperCall('designVar', variable.name) : variableId
}

function collectBindingProps(node: SceneNode, graph: SceneGraph, props: JSXProp[]): void {
  const bindings = Object.entries(node.boundVariables).toSorted(([a], [b]) => a.localeCompare(b))
  if (bindings.length === 0) return
  props.push([
    'bind',
    Object.fromEntries(bindings.map(([field, id]) => [field, variableRef(graph, id)]))
  ])
}

export function collectStateProps(
  node: SceneNode,
  ctx: ReturnType<typeof getNodeContext>,
  graph: SceneGraph,
  props: JSXProp[]
): void {
  collectConstraintProps(node, ctx, props)
  collectSizeLimitProps(node, props)
  if (node.isMask) props.push(['mask', node.maskType.toLowerCase()])
  if (!node.visible) props.push(['visible', false])
  if (node.locked) props.push(['locked', true])
  collectBindingProps(node, graph, props)
}
