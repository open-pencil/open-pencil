import { omit } from 'es-toolkit'

import type { NodeType, SceneGraph, SceneNode } from '@open-pencil/scene-graph'

import { designJSXProp } from '../definitions'
import { isTreeNode, type TreeNode } from '../tree'
import {
  BEHAVIOUR_PROPS,
  bindInput,
  bindPart,
  containerPart,
  createScope,
  finishRoot,
  namesComponent,
  rekaRole,
  wrapRepeatedParts,
  type RekaScope
} from './index'

/** Render children in the renderer's order, returning their layers in written order. */
export type RenderChildren = (
  children: TreeNode[],
  parentId: string,
  scope?: RekaScope
) => Promise<SceneNode[]>
export type CreateElement = (nodeType: NodeType, tree: TreeNode, parentId: string) => SceneNode
export type RenderInstance = (tree: TreeNode, parentId: string) => Promise<SceneNode>

function withoutBehaviourProps(tree: TreeNode): TreeNode {
  return { ...tree, props: omit(tree.props, BEHAVIOUR_PROPS) }
}

async function renderChildren(
  graph: SceneGraph,
  render: RenderChildren,
  children: TreeNode['children'],
  parentId: string,
  scope: RekaScope | undefined
): Promise<void> {
  const trees = children.filter(isTreeNode)
  const layers = await render(trees, parentId, scope)
  // Only the first tab's panel shows as designed; preview shows the others as chosen.
  const panels = trees.flatMap((tree, index) => {
    const role = rekaRole(tree.type)
    return role?.role === 'repeat' && role.container === 'panels'
      ? [{ tree, layer: layers[index] }]
      : []
  })
  for (const { tree, layer } of panels.slice(1))
    if (tree.props.visible === undefined) graph.updateNode(layer.id, { visible: false })
}

/** A name for a part that JSX leaves unnamed: the Reka part it is, such as Thumb. */
function named(tree: TreeNode, fallback: string): TreeNode {
  return tree.props.name === undefined
    ? { ...tree, props: { ...tree.props, name: fallback } }
    : tree
}

/** The props that give a frame a layout or size of its own, under any of their names. */
const LAYOUT_PROPS = ['flex', 'display', 'w', 'h']

/**
 * A part that holds content, such as a panel or a trigger, with no layout of its own stacks
 * its children in a column that hugs them, rather than pinning them in a fixed box.
 */
function laidOut(tree: TreeNode): TreeNode {
  const content = tree.children.some((child) => typeof child !== 'string')
  if (!content || LAYOUT_PROPS.some((prop) => designJSXProp(tree.props, prop) !== undefined))
    return tree
  return { ...tree, props: { ...tree.props, flex: 'col' } }
}

/**
 * Render a Reka UI element: a root as a main component (or a component set, when it has
 * variants) that behaves as its control, a part as the slot that draws it, and an input as the
 * text layer of the field's text property. Returns undefined for other elements.
 */
export async function renderRekaNode(
  graph: SceneGraph,
  tree: TreeNode,
  parentId: string,
  scope: RekaScope | undefined,
  hooks: {
    renderChildren: RenderChildren
    create: CreateElement
    instance: RenderInstance
    /** Derive a component set's variant properties from its variants' names. */
    finishSet: (setId: string) => void
  }
): Promise<SceneNode | undefined> {
  const container = containerPart(tree.type)
  const role = container ? { role: 'part' as const, part: container } : rekaRole(tree.type)
  if (!role) return undefined
  const partName = tree.type.slice(tree.type.indexOf('.') + 1)
  switch (role.role) {
    case 'root': {
      // A group's item that names a component is an item, drawn as an instance of it.
      if (namesComponent(tree.props)) return hooks.instance(tree, parentId)
      const variants = tree.children.some(
        (child) => typeof child !== 'string' && child.type === 'component'
      )
      const root = hooks.create(
        variants ? 'COMPONENT_SET' : 'COMPONENT',
        withoutBehaviourProps(tree),
        parentId
      )
      const own = createScope(role.kind, root.id)
      await renderChildren(
        graph,
        hooks.renderChildren,
        wrapRepeatedParts(tree, role.kind),
        root.id,
        own
      )
      if (variants) hooks.finishSet(root.id)
      finishRoot(graph, own, tree.props)
      return root
    }
    case 'part': {
      if (!scope) throw new Error(`<${tree.type}> must be inside its Root`)
      const frame = hooks.create('FRAME', laidOut(named(tree, partName)), parentId)
      await renderChildren(graph, hooks.renderChildren, tree.children, frame.id, scope)
      bindPart(graph, scope, frame, role.part)
      return frame
    }
    case 'repeat': {
      const frame = hooks.create('FRAME', laidOut(named(tree, partName)), parentId)
      await renderChildren(graph, hooks.renderChildren, tree.children, frame.id, scope)
      return frame
    }
    case 'input': {
      if (!scope) throw new Error(`<${tree.type}> must be inside its Root`)
      const text = hooks.create('TEXT', named(tree, 'Text'), parentId)
      bindInput(
        graph,
        scope,
        text,
        role.valueId,
        typeof tree.props.name === 'string' ? tree.props.name : 'Text'
      )
      return text
    }
    case 'frame': {
      const frame = hooks.create('FRAME', laidOut(named(tree, partName)), parentId)
      await renderChildren(graph, hooks.renderChildren, tree.children, frame.id, scope)
      return frame
    }
  }
  return undefined
}
