import { omit } from 'es-toolkit'

import {
  createDefaultNode,
  type NodeType,
  type SceneGraph,
  type SceneNode
} from '@open-pencil/scene-graph'

import type { JSXAttributeSource } from './export'
import * as React from './mini-react'
import { buildComponent } from './render'
import { elementOverrides } from './renderer'
import { resolveToTree } from './tree'

export interface JSXNodeFields {
  /** Every field the attributes describe, with defaults for the ones they leave out. */
  fields: Partial<SceneNode>
  /** Variable IDs by bound field, such as `fills/0/color`. */
  bindings: Record<string, string>
}

/**
 * The node state a `nodeType` node under `parentId` gets from `attributes`, as rendering
 * would set it, without creating a node. Diffing two results gives the fields an attribute
 * change moves, so an update leaves state that JSX does not describe untouched.
 */
export function jsxNodeFields(
  graph: SceneGraph,
  nodeType: NodeType,
  attributes: JSXAttributeSource[],
  parentId: string
): JSXNodeFields {
  const source = `<Frame ${attributes.map((attribute) => attribute.source).join(' ')} />`
  const tree = resolveToTree(React.createElement(buildComponent(source), null))
  if (!tree) throw new Error(`Invalid JSX attributes: ${source}`)
  const { overrides, bindings } = elementOverrides(graph, nodeType, tree, parentId)
  const defaults = omit(
    createDefaultNode(() => '', nodeType),
    ['id', 'parentId', 'childIds']
  )
  return { fields: { ...defaults, ...overrides }, bindings }
}
