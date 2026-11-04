import * as v from 'valibot'

import type { FigmaNodeProxy } from '#core/figma-api'
import {
  toolNumber,
  nodeIdInputSchema,
  defineTool,
  nodeSummary,
  nodeToResult
} from '#core/tools/schema'

interface TreeEntry {
  id: string
  type: string
  name: string
  w: number
  h: number
  text?: string
  children?: TreeEntry[]
}

function nodeToTreeEntry(
  node: FigmaNodeProxy,
  level: number,
  maxDepth?: number,
  typeFilter?: Set<string>
): TreeEntry | null {
  const children: TreeEntry[] = []
  if ((maxDepth === undefined || level < maxDepth) && node.children.length > 0) {
    for (const child of node.children) {
      const entry = nodeToTreeEntry(child, level + 1, maxDepth, typeFilter)
      if (entry) children.push(entry)
    }
  }

  const matches = !typeFilter || typeFilter.has(node.type)
  if (!matches && children.length === 0) return null

  const entry: TreeEntry = {
    id: node.id,
    type: node.type,
    name: node.name,
    w: node.width,
    h: node.height
  }
  if (node.type === 'TEXT') entry.text = node.characters
  if (children.length > 0) entry.children = children
  return entry
}

export const getPageTree = defineTool({
  name: 'get_page_tree',
  description:
    'Get the node tree of the current page. Returns lightweight hierarchy: id, type, name, size, and text for TEXT nodes. Use depth, root_id, or node_types to keep large pages small. Use get_node for full properties of a specific node.',
  execution: { kind: 'async', mutation: 'none' },
  input: v.strictObject({
    depth: v.optional(
      toolNumber(
        v.pipe(
          v.number(),
          v.minValue(1),
          v.description(
            'Max nesting depth to return (1 = returned root nodes only). Default: unlimited'
          )
        )
      )
    ),
    root_id: v.optional(
      v.pipe(
        v.string(),
        v.description('Return only this node subtree instead of the whole current page')
      )
    ),
    node_types: v.optional(
      v.pipe(
        v.array(v.string()),
        v.minLength(1),
        v.description('Keep only these node types and their ancestors, for example FRAME or TEXT')
      )
    )
  }),
  execute: async (figma, { depth, root_id, node_types }) => {
    const typeFilter = node_types && node_types.length > 0 ? new Set(node_types) : undefined

    if (root_id !== undefined) {
      // A layer on a page not yet visited loads that page, as in Figma's dynamic-page mode.
      const root = await figma.getNodeByIdAsync(root_id)
      if (!root) return { error: `Node "${root_id}" not found` }
      // A page not yet visited has no layers until it loads.
      if (figma.graph.getNode(root.id)?.type === 'CANVAS') await root.loadAsync()
      return { root: root.id, tree: nodeToTreeEntry(root, 1, depth, typeFilter) }
    }

    const page = figma.currentPage
    const children: TreeEntry[] = []
    for (const child of page.children) {
      const entry = nodeToTreeEntry(child, 1, depth, typeFilter)
      if (entry) children.push(entry)
    }
    return { page: page.name, children }
  }
})

export const getNode = defineTool({
  name: 'get_node',
  description:
    'Get detailed properties of a node by ID. Use depth to limit child recursion (0 = node only, 1 = direct children, etc). Default: unlimited.',
  execution: { kind: 'async', mutation: 'none' },
  input: v.strictObject({
    id: nodeIdInputSchema,
    depth: v.optional(
      toolNumber(
        v.pipe(
          v.number(),
          v.description('Max depth of children to include (0 = no children). Default: unlimited')
        )
      )
    )
  }),
  execute: async (figma, { id, depth }) => {
    // A layer on a page not yet visited loads that page, as in Figma's dynamic-page mode.
    const node = await figma.getNodeByIdAsync(id)
    if (!node) return { error: `Node "${id}" not found` }
    return nodeToResult(node, depth)
  }
})

export const findNodes = defineTool({
  name: 'find_nodes',
  description: 'Find nodes by name pattern and/or type.',
  execution: { kind: 'sync', mutation: 'none' },
  input: v.strictObject({
    name: v.optional(
      v.pipe(v.string(), v.description('Name substring to match (case-insensitive)'))
    ),
    type: v.optional(
      v.pipe(
        v.picklist([
          'FRAME',
          'RECTANGLE',
          'ELLIPSE',
          'TEXT',
          'LINE',
          'STAR',
          'POLYGON',
          'SECTION',
          'GROUP',
          'COMPONENT',
          'INSTANCE',
          'VECTOR'
        ]),
        v.description('Node type filter')
      )
    )
  }),
  execute: (figma, args) => {
    const page = figma.currentPage
    const matches = page.findAll((node) => {
      if (args.type && node.type !== args.type) return false
      if (args.name && !node.name.toLowerCase().includes(args.name.toLowerCase())) return false
      return true
    })
    return { count: matches.length, nodes: matches.map(nodeSummary) }
  }
})
