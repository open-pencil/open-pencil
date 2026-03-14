import { createTwoFilesPatch } from 'diff'

import { sceneNodeToJSX } from '../render/export-jsx'
import { defineTool, nodeSummary, nodeToResult } from './schema'
import { queryByXPath } from '../xpath'

import type { FigmaNodeProxy } from '../figma-api'

export const getSelection = defineTool({
  name: 'get_selection',
  description: 'Get details about currently selected nodes.',
  params: {},
  execute: (figma) => {
    const sel = figma.currentPage.selection
    return { selection: sel.map(nodeToResult) }
  }
})

interface TreeEntry {
  id: string
  type: string
  name: string
  w: number
  h: number
  children?: TreeEntry[]
}

function nodeToTreeEntry(node: FigmaNodeProxy): TreeEntry {
  const entry: TreeEntry = { id: node.id, type: node.type, name: node.name, w: node.width, h: node.height }
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
  description: 'Get detailed properties of a node by ID. Use depth to limit child recursion (0 = node only, 1 = direct children, etc). Default: unlimited.',
  params: {
    id: { type: 'string', description: 'Node ID', required: true },
    depth: { type: 'number', description: 'Max depth of children to include (0 = no children). Default: unlimited' }
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

export const getComponents = defineTool({
  name: 'get_components',
  description: 'List all components in the document, optionally filtered by name.',
  params: {
    name: { type: 'string', description: 'Filter by name (case-insensitive substring)' },
    limit: { type: 'number', description: 'Max results (default: 50)' }
  },
  execute: (figma, args) => {
    const limit = args.limit ?? 50
    const nameFilter = args.name?.toLowerCase()
    const components: { id: string; name: string; type: string; page: string }[] = []

    for (const page of figma.root.children) {
      if (components.length >= limit) break
      page.findAll((node) => {
        if (components.length >= limit) return false
        if (node.type !== 'COMPONENT' && node.type !== 'COMPONENT_SET') return false
        if (nameFilter && !node.name.toLowerCase().includes(nameFilter)) return false
        components.push({ id: node.id, name: node.name, type: node.type, page: page.name })
        return false
      })
    }

    return { count: components.length, components }
  }
})

export const listPages = defineTool({
  name: 'list_pages',
  description: 'List all pages in the document.',
  params: {},
  execute: (figma) => {
    const pages = figma.root.children
    return {
      current: figma.currentPage.name,
      pages: pages.map((p) => ({ id: p.id, name: p.name }))
    }
  }
})

export const switchPage = defineTool({
  name: 'switch_page',
  mutates: true,
  description: 'Switch to a different page by name or ID.',
  params: {
    page: { type: 'string', description: 'Page name or ID', required: true }
  },
  execute: (figma, { page }) => {
    const target = figma.root.children.find((p) => p.name === page) ?? figma.getNodeById(page)
    if (!target) return { error: `Page "${page}" not found` }
    figma.currentPage = target
    return { page: target.name, id: target.id }
  }
})

export const getCurrentPage = defineTool({
  name: 'get_current_page',
  description: 'Get the current page name and ID.',
  params: {},
  execute: (figma) => {
    return { id: figma.currentPage.id, name: figma.currentPage.name }
  }
})

export const pageBounds = defineTool({
  name: 'page_bounds',
  description: 'Get bounding box of all objects on the current page.',
  params: {},
  execute: (figma) => {
    const page = figma.currentPage
    let minX = Infinity
    let minY = Infinity
    let maxX = -Infinity
    let maxY = -Infinity
    for (const child of page.children) {
      const bounds = child.absoluteBoundingBox
      minX = Math.min(minX, bounds.x)
      minY = Math.min(minY, bounds.y)
      maxX = Math.max(maxX, bounds.x + bounds.width)
      maxY = Math.max(maxY, bounds.y + bounds.height)
    }
    if (minX === Infinity) return { x: 0, y: 0, width: 0, height: 0 }
    return { x: minX, y: minY, width: maxX - minX, height: maxY - minY }
  }
})

export const selectNodes = defineTool({
  name: 'select_nodes',
  mutates: true,
  description: 'Select one or more nodes by ID.',
  params: {
    ids: { type: 'string[]', description: 'Node IDs to select', required: true }
  },
  execute: (figma, { ids }) => {
    figma.currentPage.selection = ids
      .map((id) => figma.getNodeById(id))
      .filter((n): n is FigmaNodeProxy => n !== null)
    return { selected: ids }
  }
})

export const listFonts = defineTool({
  name: 'list_fonts',
  description: 'List fonts used in the current page.',
  params: {
    family: { type: 'string', description: 'Filter by family name (substring)' }
  },
  execute: (figma, args) => {
    const fonts = new Map<string, Set<number>>()
    const page = figma.currentPage
    page.findAll((node) => {
      if (node.type === 'TEXT') {
        const raw = figma.graph.getNode(node.id)
        if (raw) {
          const key = raw.fontFamily
          if (!fonts.has(key)) fonts.set(key, new Set())
          fonts.get(key)?.add(raw.fontWeight)
        }
      }
      return false
    })
    let result = [...fonts.entries()].map(([family, weights]) => ({
      family,
      weights: [...weights].sort((a, b) => a - b)
    }))
    if (args.family) {
      const q = args.family.toLowerCase()
      result = result.filter((f) => f.family.toLowerCase().includes(q))
    }
    return { count: result.length, fonts: result }
  }
})

export const queryNodes = defineTool({
  name: 'query_nodes',
  description: `Query nodes using XPath selectors. Node types are element names (FRAME, TEXT, RECTANGLE, ELLIPSE, etc.). Attributes: name, width, height, x, y, visible, opacity, cornerRadius, fontSize, fontFamily, fontWeight, layoutMode, itemSpacing, paddingTop/Right/Bottom/Left, strokeWeight, rotation, locked, blendMode, text, lineHeight, letterSpacing.

Examples:
  //FRAME — all frames
  //FRAME[@width < 300] — frames narrower than 300px
  //COMPONENT[starts-with(@name, 'Button')] — components starting with "Button"
  //SECTION/FRAME — direct frame children of sections
  //SECTION//TEXT — all text nodes inside sections
  //*[@cornerRadius > 0] — any node with corner radius
  //TEXT[contains(@text, 'Hello')] — text nodes containing "Hello"`,
  params: {
    selector: { type: 'string', description: 'XPath selector', required: true },
    page: { type: 'string', description: 'Page name (default: current page)' },
    limit: { type: 'number', description: 'Max results (default: 1000)' }
  },
  execute: async (figma, args) => {
    try {
      const nodes = await queryByXPath(figma.graph, args.selector, {
        page: args.page ?? figma.currentPage.name,
        limit: args.limit
      })
      return {
        count: nodes.length,
        nodes: nodes.map((n) => ({ id: n.id, name: n.name, type: n.type }))
      }
    } catch (err) {
      return { error: `XPath error: ${err instanceof Error ? err.message : String(err)}` }
    }
  }
})

const MAX_JSX_LENGTH = 12_000

export const getJsx = defineTool({
  name: 'get_jsx',
  description:
    'Get JSX representation of a node and its children. Compact round-trip format — same syntax as the render tool.',
  params: {
    id: { type: 'string', description: 'Node ID', required: true }
  },
  execute: (figma, { id }) => {
    const node = figma.getNodeById(id)
    if (!node) return { error: `Node "${id}" not found` }
    const jsx = sceneNodeToJSX(id, figma.graph)
    if (jsx.length > MAX_JSX_LENGTH) {
      return {
        id,
        name: node.name,
        jsx: jsx.slice(0, MAX_JSX_LENGTH),
        truncated: true,
        totalLength: jsx.length
      }
    }
    return { id, name: node.name, jsx }
  }
})

export const diffJsx = defineTool({
  name: 'diff_jsx',
  description:
    'Structural diff between two nodes in JSX format. Shows added/removed children, changed props.',
  params: {
    from: { type: 'string', description: 'Source node ID', required: true },
    to: { type: 'string', description: 'Target node ID', required: true }
  },
  execute: (figma, { from, to }) => {
    const fromNode = figma.getNodeById(from)
    if (!fromNode) return { error: `Node "${from}" not found` }
    const toNode = figma.getNodeById(to)
    if (!toNode) return { error: `Node "${to}" not found` }

    const fromJsx = sceneNodeToJSX(from, figma.graph)
    const toJsx = sceneNodeToJSX(to, figma.graph)

    if (fromJsx === toJsx) return { diff: null, message: 'No differences' }

    const patch = createTwoFilesPatch(
      fromNode.name,
      toNode.name,
      fromJsx,
      toJsx,
      'source',
      'target',
      { context: 3 }
    )
    return { diff: patch }
  }
})
