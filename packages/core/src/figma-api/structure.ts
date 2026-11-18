import type {
  BaseNode,
  BooleanOperationNode,
  ChildrenMixin,
  ComponentNode,
  ComponentSetNode,
  GroupNode,
  SceneNode,
  VectorNode
} from '@figma/plugin-typings/plugin-api-standalone'

import type { SceneGraph, SceneNode as CoreSceneNode } from '@open-pencil/scene-graph'
import type { GroupFitOptions } from '@open-pencil/scene-graph/group-bounds'

import type { SkiaRenderer } from '#core/canvas'
import { booleanOperationPaints, createBooleanOperation } from '#core/editor/structure/boolean'
import { wrapNodes } from '#core/editor/structure/container-wrap'
import { ungroupNode } from '#core/editor/structure/group/ungroup'

import { componentFromNode } from './components'
import { FigmaCreateMethods } from './creation'
import { flattenSceneNodes } from './flatten'
import { graphOf } from './graph'
import type {
  FigmaBooleanOperationNode,
  FigmaComponentNode,
  FigmaComponentSetNode,
  FigmaGroupNode,
  FigmaVectorNode
} from './node-types'
import { INTERNAL_ID, type FigmaNodeProxy } from './proxy'
import { combineComponentsAsVariants } from './variants'

/** The scene graph ID of a node a script passes, a Figma node or one of the API's proxies. */
export function nodeIdOf(node: BaseNode | FigmaNodeProxy): string {
  return (node as BaseNode & { [INTERNAL_ID]: string })[INTERNAL_ID]
}

/** The scene graph node behind a node a script passes; throws when it is gone. */
export function sceneNodeOf(graph: SceneGraph, node: BaseNode | FigmaNodeProxy): CoreSceneNode {
  const id = nodeIdOf(node)
  const raw = graph.getNode(id)
  if (!raw) throw new Error(`Node ${id} not found`)
  return raw
}

/**
 * Figma's members of `figma` that restructure layers: grouping, components and variants, boolean
 * operations, and flattening, which `FigmaAPI` extends. Each runs the editor's own command.
 */
export abstract class FigmaStructureMethods extends FigmaCreateMethods {
  abstract get currentPage(): FigmaNodeProxy
  abstract get renderer(): SkiaRenderer | null
  abstract get groupFitOptions(): GroupFitOptions

  // --- Grouping ---

  group(
    nodes: ReadonlyArray<FigmaNodeProxy>,
    parent: FigmaNodeProxy,
    index?: number
  ): FigmaGroupNode
  group(nodes: ReadonlyArray<BaseNode>, parent: BaseNode & ChildrenMixin, index?: number): GroupNode
  group(
    nodes: ReadonlyArray<BaseNode | FigmaNodeProxy>,
    parent: (BaseNode & ChildrenMixin) | FigmaNodeProxy,
    index?: number
  ): FigmaGroupNode {
    const graph = graphOf(this)
    const parentId = nodeIdOf(parent)
    const members = nodes.map((node) => sceneNodeOf(graph, node))
    const groupNode = wrapNodes(graph, 'GROUP', members, parentId, index)
    return this.wrapNode(groupNode.id) as FigmaGroupNode
  }

  ungroup(node: FigmaNodeProxy): FigmaNodeProxy[]
  ungroup(node: SceneNode & ChildrenMixin): Array<SceneNode>
  ungroup(node: (SceneNode & ChildrenMixin) | FigmaNodeProxy): Array<SceneNode> | FigmaNodeProxy[] {
    const children = ungroupNode(graphOf(this), nodeIdOf(node)) ?? []
    return children.map((id) => this.wrapNode(id))
  }

  createComponentFromNode(node: FigmaNodeProxy): FigmaNodeProxy {
    const graph = graphOf(this)
    const raw = graph.getNode(node[INTERNAL_ID])
    if (!raw) throw new Error('Node not found')
    return this.wrapNode(componentFromNode(graph, raw, raw.parentId ?? this.currentPageId).id)
  }

  combineAsVariants(
    nodes: ReadonlyArray<FigmaComponentNode>,
    parent: FigmaNodeProxy,
    index?: number
  ): FigmaComponentSetNode
  combineAsVariants(
    nodes: ReadonlyArray<ComponentNode>,
    parent: BaseNode & ChildrenMixin,
    index?: number
  ): ComponentSetNode
  combineAsVariants(
    nodes: ReadonlyArray<ComponentNode | FigmaComponentNode>,
    parent: (BaseNode & ChildrenMixin) | FigmaNodeProxy,
    index?: number
  ): FigmaComponentSetNode {
    const componentSet = combineComponentsAsVariants(
      graphOf(this),
      nodes.map((node) => nodeIdOf(node)),
      nodeIdOf(parent),
      index
    )
    return this.wrapNode(componentSet.id) as FigmaComponentSetNode
  }

  // --- Boolean Operations ---

  #booleanOperation(
    operation: 'UNION' | 'SUBTRACT' | 'INTERSECT' | 'EXCLUDE',
    nodes: ReadonlyArray<BaseNode | FigmaNodeProxy>,
    parent: (BaseNode & ChildrenMixin) | FigmaNodeProxy,
    index?: number
  ): FigmaBooleanOperationNode {
    if (nodes.length < 2) throw new Error('Need at least 2 nodes for boolean operation')
    const graph = graphOf(this)
    const parentId = nodeIdOf(parent)
    const members = nodes.map((node) => sceneNodeOf(graph, node))
    const { node: group } = createBooleanOperation(
      graph,
      members,
      parentId,
      operation,
      index,
      booleanOperationPaints(operation, members, 'script'),
      this.groupFitOptions
    )
    return this.wrapNode(group.id) as FigmaBooleanOperationNode
  }

  union(
    nodes: ReadonlyArray<FigmaNodeProxy>,
    parent: FigmaNodeProxy,
    index?: number
  ): FigmaBooleanOperationNode
  union(
    nodes: ReadonlyArray<BaseNode>,
    parent: BaseNode & ChildrenMixin,
    index?: number
  ): BooleanOperationNode
  union(
    nodes: ReadonlyArray<BaseNode | FigmaNodeProxy>,
    parent: (BaseNode & ChildrenMixin) | FigmaNodeProxy,
    index?: number
  ): FigmaBooleanOperationNode {
    return this.#booleanOperation('UNION', nodes, parent, index)
  }

  subtract(
    nodes: ReadonlyArray<FigmaNodeProxy>,
    parent: FigmaNodeProxy,
    index?: number
  ): FigmaBooleanOperationNode
  subtract(
    nodes: ReadonlyArray<BaseNode>,
    parent: BaseNode & ChildrenMixin,
    index?: number
  ): BooleanOperationNode
  subtract(
    nodes: ReadonlyArray<BaseNode | FigmaNodeProxy>,
    parent: (BaseNode & ChildrenMixin) | FigmaNodeProxy,
    index?: number
  ): FigmaBooleanOperationNode {
    return this.#booleanOperation('SUBTRACT', nodes, parent, index)
  }

  intersect(
    nodes: ReadonlyArray<FigmaNodeProxy>,
    parent: FigmaNodeProxy,
    index?: number
  ): FigmaBooleanOperationNode
  intersect(
    nodes: ReadonlyArray<BaseNode>,
    parent: BaseNode & ChildrenMixin,
    index?: number
  ): BooleanOperationNode
  intersect(
    nodes: ReadonlyArray<BaseNode | FigmaNodeProxy>,
    parent: (BaseNode & ChildrenMixin) | FigmaNodeProxy,
    index?: number
  ): FigmaBooleanOperationNode {
    return this.#booleanOperation('INTERSECT', nodes, parent, index)
  }

  exclude(
    nodes: ReadonlyArray<FigmaNodeProxy>,
    parent: FigmaNodeProxy,
    index?: number
  ): FigmaBooleanOperationNode
  exclude(
    nodes: ReadonlyArray<BaseNode>,
    parent: BaseNode & ChildrenMixin,
    index?: number
  ): BooleanOperationNode
  exclude(
    nodes: ReadonlyArray<BaseNode | FigmaNodeProxy>,
    parent: (BaseNode & ChildrenMixin) | FigmaNodeProxy,
    index?: number
  ): FigmaBooleanOperationNode {
    return this.#booleanOperation('EXCLUDE', nodes, parent, index)
  }

  // --- Flatten ---

  flatten(
    nodes: ReadonlyArray<FigmaNodeProxy>,
    parent?: FigmaNodeProxy,
    index?: number
  ): FigmaVectorNode
  flatten(
    nodes: ReadonlyArray<BaseNode>,
    parent?: BaseNode & ChildrenMixin,
    index?: number
  ): VectorNode
  flatten(
    nodes: ReadonlyArray<BaseNode | FigmaNodeProxy>,
    parent?: (BaseNode & ChildrenMixin) | FigmaNodeProxy,
    index?: number
  ): FigmaVectorNode {
    if (nodes.length === 0) throw new Error('Need at least 1 node to flatten')
    const graph = graphOf(this)
    const parentId = nodeIdOf(parent ?? this.currentPage)
    const sourceNodes: CoreSceneNode[] = []
    for (const node of nodes) {
      const raw = graph.getNode(nodeIdOf(node))
      if (!raw) throw new Error('Node not found')
      sourceNodes.push(raw)
    }
    const vector = flattenSceneNodes(graph, this.renderer, sourceNodes, parentId)
    if (index != null) graph.insertChildAt(vector.id, parentId, index)
    for (const node of nodes) {
      graph.deleteNode(nodeIdOf(node))
    }
    return this.wrapNode(vector.id) as FigmaVectorNode
  }
}
