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
  if (children.length > 0) entry.children = children
  return entry
}

export const getPageTree = defineTool({
  name: 'get_page_tree',
  description:
    'Get a lightweight hierarchy for the current page. For document discovery, call with depth=1 and node_types=["FRAME"] to list only root frames, then use export_image on relevant frame IDs before deeper inspection. Use root_id or node_types to keep responses small; use get_node only for precise properties.',
  params: {
    depth: {
      type: 'number',
      description:
        'Max nesting depth (1 = direct page children/root nodes only). Default: unlimited',
      min: 1
    },
    root_id: {
      type: 'string',
      description: 'Return only this node subtree instead of the whole current page'
    },
    node_types: {
      type: 'string[]',
      description:
        'Keep only these node types and their ancestors. Use ["FRAME"] with depth=1 for root frames'
    }
  },
  execute: (figma, { depth, root_id, node_types }) => {
    const typeFilter = node_types && node_types.length > 0 ? new Set(node_types) : undefined

    if (root_id !== undefined) {
      const root = figma.getNodeById(root_id)
      if (!root) return { error: `Node "${root_id}" not found` }
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
    'Get detailed properties of a node by an ID returned by another tool. Never guess IDs or use 0:0, which is the document root. Use depth to limit child recursion (0 = node only, 1 = direct children, etc). Default: unlimited.',
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
  description:
    'Find nodes on a page or inside a root node, with pagination and hierarchy context. Depth defaults to 1, returning only direct children; use a result ID as root_id to progressively explore its children. Prefer type=FRAME to discover top-level screens and flows. Common types: FRAME, SECTION, COMPONENT, COMPONENT_SET, INSTANCE, GROUP, TEXT, RECTANGLE. If type is omitted, all node types match. Results are in document order and include parent_id, depth, path, and direct child_count.',
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
        'COMPONENT_SET',
        'INSTANCE',
        'VECTOR',
        'BOOLEAN_OPERATION'
      ]
    },
    page: {
      type: 'string',
      description: 'Page name or ID to search (default: current page)'
    },
    root_id: {
      type: 'string',
      description: 'Search only descendants of this node; it must belong to the selected page'
    },
    depth: {
      type: 'number',
      description:
        'Maximum descendant depth from the page or root (default: 1; 1 = direct children only)',
      min: 1,
      max: 100,
      default: 1
    },
    limit: {
      type: 'number',
      description: 'Maximum results to return (default: 50, max: 200)',
      min: 1,
      max: 200,
      default: 50
    },
    offset: {
      type: 'number',
      description: 'Number of matching results to skip (default: 0)',
      min: 0,
      default: 0
    }
  },
  execute: (figma, args) => {
    const page = args.page
      ? figma.root.children.find(
          (candidate) => candidate.id === args.page || candidate.name === args.page
        )
      : figma.currentPage
    if (!page) return { error: `Page "${args.page}" not found` }

    const root = args.root_id ? figma.getNodeById(args.root_id) : page
    if (!root) return { error: `Node "${args.root_id}" not found` }

    let ancestor = root
    while (ancestor.parent && ancestor.parent.id !== figma.root.id) ancestor = ancestor.parent
    if (ancestor.id !== page.id) {
      return { error: `Node "${root.id}" does not belong to page "${page.name}"` }
    }

    const matches: Array<{
      node: FigmaNodeProxy
      parentId: string
      depth: number
      path: string[]
    }> = []
    const maxDepth = Math.min(100, Math.max(1, Math.floor(args.depth ?? 1)))
    const walk = (parent: FigmaNodeProxy, depth: number, path: string[]) => {
      if (depth > maxDepth) return
      for (const node of parent.children) {
        const nodePath = [...path, node.name]
        const typeMatches = !args.type || node.type === args.type
        const nameMatches = !args.name || node.name.toLowerCase().includes(args.name.toLowerCase())
        if (typeMatches && nameMatches) {
          matches.push({ node, parentId: parent.id, depth, path: nodePath })
        }
        walk(node, depth + 1, nodePath)
      }
    }
    walk(root, 1, root.id === page.id ? [page.name] : [page.name, root.name])

    const offset = Math.max(0, Math.floor(args.offset ?? 0))
    const limit = Math.min(200, Math.max(1, Math.floor(args.limit ?? 50)))
    const selected = matches.slice(offset, offset + limit)
    const nextOffset = offset + selected.length
    const hasMore = nextOffset < matches.length
    const filterHint =
      !args.name && !args.type
        ? 'For document discovery, prefer type=FRAME, then inspect relevant results using their id as root_id.'
        : 'Narrow further with page, root_id, depth, name, or type when needed.'
    const hierarchyHint = selected.some(({ node }) => node.children.length > 0)
      ? 'Results with child_count > 0 can be expanded with find_nodes using that node id as root_id; depth defaults to 1.'
      : 'No returned result has direct children to expand.'
    const paginationHint = hasMore
      ? `More matches are available. Continue with offset=${nextOffset} and limit=${limit}.`
      : 'All matching results in this scope were returned.'

    return {
      page: { id: page.id, name: page.name, current: page.id === figma.currentPage.id },
      root: { id: root.id, name: root.name, type: root.type },
      count: matches.length,
      total: matches.length,
      returned: selected.length,
      offset,
      limit,
      depth: maxDepth,
      has_more: hasMore,
      next_offset: hasMore ? nextOffset : null,
      nodes: selected.map(({ node, parentId, depth, path }) => ({
        ...nodeSummary(node),
        parent_id: parentId,
        depth,
        path,
        child_count: node.children.length
      })),
      hints: [filterHint, hierarchyHint, paginationHint]
    }
  }
})
