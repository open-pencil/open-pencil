import type { NodeType, SceneGraph, SceneNode } from '@open-pencil/scene-graph'

import type { TreeNode } from '../tree'
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

export type RenderChild = (
  tree: TreeNode,
  parentId: string,
  scope?: RekaScope
) => Promise<SceneNode>
export type CreateElement = (nodeType: NodeType, tree: TreeNode, parentId: string) => SceneNode
export type RenderInstance = (tree: TreeNode, parentId: string) => Promise<SceneNode>

function withoutBehaviourProps(tree: TreeNode): TreeNode {
  const props = Object.fromEntries(
    Object.entries(tree.props).filter(
      ([key]) => !(BEHAVIOUR_PROPS as readonly string[]).includes(key)
    )
  )
  return { ...tree, props }
}

async function renderChildren(
  render: RenderChild,
  children: TreeNode['children'],
  parentId: string,
  scope: RekaScope | undefined
): Promise<void> {
  for (const child of children) if (typeof child !== 'string') await render(child, parentId, scope)
}

/** A name for a part that JSX leaves unnamed: the Reka part it is, such as Thumb. */
function named(tree: TreeNode, fallback: string): TreeNode {
  return tree.props.name === undefined
    ? { ...tree, props: { ...tree.props, name: fallback } }
    : tree
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
    render: RenderChild
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
      await renderChildren(hooks.render, wrapRepeatedParts(tree, role.kind), root.id, own)
      if (variants) hooks.finishSet(root.id)
      finishRoot(graph, own, tree.props)
      return root
    }
    case 'part': {
      if (!scope) throw new Error(`<${tree.type}> must be inside its Root`)
      const frame = hooks.create('FRAME', named(tree, partName), parentId)
      await renderChildren(hooks.render, tree.children, frame.id, scope)
      bindPart(graph, scope, frame, role.part)
      return frame
    }
    case 'repeat': {
      const frame = hooks.create('FRAME', named(tree, partName), parentId)
      await renderChildren(hooks.render, tree.children, frame.id, scope)
      // Only the first tab's panel shows as designed; preview shows the others as chosen.
      const siblings = graph.getChildren(parentId)
      if (
        role.container === 'panels' &&
        siblings[0]?.id !== frame.id &&
        tree.props.visible === undefined
      )
        graph.updateNode(frame.id, { visible: false })
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
      const frame = hooks.create('FRAME', named(tree, partName), parentId)
      await renderChildren(hooks.render, tree.children, frame.id, scope)
      return frame
    }
  }
  return undefined
}
