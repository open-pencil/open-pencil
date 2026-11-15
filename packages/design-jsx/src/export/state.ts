import type { SceneNode } from '@open-pencil/scene-graph'

import { CONSTRAINT, MASK_TYPE } from '../enums'
import { collectBindingProps, collectModeProps } from './bindings'
import type { getNodeContext } from './helpers'
import type { JSXProp } from './value'
import type { VariableExport } from './variables'

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
    {
      horizontal: horizontal && CONSTRAINT.print(horizontal),
      vertical: vertical && CONSTRAINT.print(vertical)
    }
  ])
}

function collectSizeLimitProps(node: SceneNode, props: JSXProp[]): void {
  if (node.minWidth != null) props.push(['minW', node.minWidth])
  if (node.maxWidth != null) props.push(['maxW', node.maxWidth])
  if (node.minHeight != null) props.push(['minH', node.minHeight])
  if (node.maxHeight != null) props.push(['maxH', node.maxHeight])
}

export function collectStateProps(
  node: SceneNode,
  ctx: ReturnType<typeof getNodeContext>,
  props: JSXProp[],
  variables: VariableExport
): void {
  collectConstraintProps(node, ctx, props)
  collectSizeLimitProps(node, props)
  if (node.isMask) props.push(['mask', MASK_TYPE.print(node.maskType)])
  if (!node.visible) props.push(['visible', false])
  if (node.locked) props.push(['locked', true])
  collectModeProps(node, props, variables)
  collectBindingProps(node, props, variables)
}
