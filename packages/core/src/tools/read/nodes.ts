import type { FigmaNodeProxy } from '#core/figma-api'
import { defineTool, nodeSummary, nodeToResult } from '#core/tools/schema'

interface TreeEntry {
  id: string
  type: string
  name: string
  w: number
  h: number
  children?: TreeEntry[]
}

function nodeToTreeEntry(node: FigmaNodeProxy): TreeEntry {
  const entry: TreeEntry = {
    id: node.id,
    type: node.type,
    name: node.name,
    w: node.width,
    h: node.height
  }
  if (node.children.length > 0) {
    entry.children = node.children.map(nodeToTreeEntry)
  }
  return entry
}

export const getPageTree = defineTool({
  name: 'get_page_tree',
  description:
    'Get the node tree of the current page. Returns lightweight hierarchy: id, type, name, size. Use get_node for full properties of a specific node.',
  params: {},
  execute: (figma) => {
    const page = figma.currentPage
    return {
      page: page.name,
      children: page.children.map(nodeToTreeEntry)
    }
  }
})

export const getNode = defineTool({
  name: 'get_node',
  description:
    'Get detailed properties of a node by ID. Use depth to limit child recursion (0 = node only, 1 = direct children, etc). Default: unlimited.',
  params: {
    id: { type: 'string', description: 'Node ID', required: true },
    depth: {
      type: 'number',
      description: 'Max depth of children to include (0 = no children). Default: unlimited'
    }
  },
  execute: (figma, { id, depth }) => {
    const node = figma.getNodeById(id)
    if (!node) return { error: `Node "${id}" not found` }
    return nodeToResult(node, depth)
  }
})

export const findNodes = defineTool({
  name: 'find_nodes',
  description: 'Find nodes by name pattern and/or type.',
  params: {
    name: { type: 'string', description: 'Name substring to match (case-insensitive)' },
    type: {
      type: 'string',
      description: 'Node type filter',
      enum: [
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
      ]
    }
  },
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
