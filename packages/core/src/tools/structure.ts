import { defineTool, nodeSummary } from './schema'

import type { FigmaNodeProxy } from '../figma-api'

export const deleteNode = defineTool({
  name: 'delete_node',
  mutates: true,
  description: 'Delete a node by ID.',
  params: {
    id: { type: 'string', description: 'Node ID to delete', required: true }
  },
  execute: (figma, { id }) => {
    const node = figma.getNodeById(id)
    if (!node) return { error: `Node "${id}" not found` }
    node.remove()
    return { deleted: id }
  }
})

export const cloneNode = defineTool({
  name: 'clone_node',
  mutates: true,
  description: 'Clone (duplicate) a node.',
  params: {
    id: { type: 'string', description: 'Node ID to clone', required: true }
  },
  execute: (figma, { id }) => {
    const node = figma.getNodeById(id)
    if (!node) return { error: `Node "${id}" not found` }
    const clone = node.clone()
    return nodeSummary(clone)
  }
})

export const renameNode = defineTool({
  name: 'rename_node',
  mutates: true,
  description: 'Rename a node in the layers panel.',
  params: {
    id: { type: 'string', description: 'Node ID', required: true },
    name: { type: 'string', description: 'New name', required: true }
  },
  execute: (figma, { id, name }) => {
    const node = figma.getNodeById(id)
    if (!node) return { error: `Node "${id}" not found` }
    node.name = name
    return { id, name }
  }
})

export const reparentNode = defineTool({
  name: 'reparent_node',
  mutates: true,
  description: 'Move a node into a different parent.',
  params: {
    id: { type: 'string', description: 'Node ID to move', required: true },
    parent_id: { type: 'string', description: 'New parent node ID', required: true }
  },
  execute: (figma, { id, parent_id }) => {
    const node = figma.getNodeById(id)
    const parent = figma.getNodeById(parent_id)
    if (!node) return { error: `Node "${id}" not found` }
    if (!parent) return { error: `Parent "${parent_id}" not found` }
    parent.appendChild(node)
    return { id, parent_id }
  }
})

export const groupNodes = defineTool({
  name: 'group_nodes',
  mutates: true,
  description: 'Group selected nodes.',
  params: {
    ids: { type: 'string[]', description: 'Node IDs to group', required: true }
  },
  execute: (figma, { ids }) => {
    const nodes = ids
      .map((id) => figma.getNodeById(id))
      .filter((n): n is FigmaNodeProxy => n !== null)
    if (nodes.length < 2) return { error: 'Need at least 2 nodes to group' }
    const parent = nodes[0].parent ?? figma.currentPage
    const group = figma.group(nodes, parent)
    return nodeSummary(group)
  }
})

export const ungroupNode = defineTool({
  name: 'ungroup_node',
  mutates: true,
  description: 'Ungroup a group node.',
  params: {
    id: { type: 'string', description: 'Group node ID', required: true }
  },
  execute: (figma, { id }) => {
    const node = figma.getNodeById(id)
    if (!node) return { error: `Node "${id}" not found` }
    figma.ungroup(node)
    return { ungrouped: id }
  }
})

export const flattenNodes = defineTool({
  name: 'flatten_nodes',
  mutates: true,
  description: 'Flatten nodes into a single vector.',
  params: {
    ids: { type: 'string[]', description: 'Node IDs to flatten', required: true }
  },
  execute: (figma, { ids }) => {
    const result = figma.flattenNode(ids)
    return nodeSummary(result)
  }
})

export const nodeToComponent = defineTool({
  name: 'node_to_component',
  mutates: true,
  description: 'Convert one or more frames/groups into components.',
  params: {
    ids: { type: 'string[]', description: 'Node IDs to convert', required: true }
  },
  execute: (figma, { ids }) => {
    const results: { id: string; name: string; originalId: string }[] = []
    for (const id of ids) {
      const node = figma.getNodeById(id)
      if (!node) continue
      const comp = figma.createComponentFromNode(node)
      results.push({ id: comp.id, name: comp.name, originalId: id })
    }
    return { converted: results }
  }
})

export const nodeBounds = defineTool({
  name: 'node_bounds',
  description: 'Get absolute bounding box of a node.',
  params: {
    id: { type: 'string', description: 'Node ID', required: true }
  },
  execute: (figma, { id }) => {
    const node = figma.getNodeById(id)
    if (!node) return { error: `Node "${id}" not found` }
    return { id, bounds: node.absoluteBoundingBox }
  }
})

export const nodeMove = defineTool({
  name: 'node_move',
  mutates: true,
  description: 'Move a node to new coordinates.',
  params: {
    id: { type: 'string', description: 'Node ID', required: true },
    x: { type: 'number', description: 'X position', required: true },
    y: { type: 'number', description: 'Y position', required: true }
  },
  execute: (figma, { id, x, y }) => {
    const node = figma.getNodeById(id)
    if (!node) return { error: `Node "${id}" not found` }
    node.x = x
    node.y = y
    return { id, x, y }
  }
})

export const nodeResize = defineTool({
  name: 'node_resize',
  mutates: true,
  description: 'Resize a node.',
  params: {
    id: { type: 'string', description: 'Node ID', required: true },
    width: { type: 'number', description: 'Width', required: true, min: 1 },
    height: { type: 'number', description: 'Height', required: true, min: 1 }
  },
  execute: (figma, { id, width, height }) => {
    const node = figma.getNodeById(id)
    if (!node) return { error: `Node "${id}" not found` }
    node.resize(width, height)
    return { id, width, height }
  }
})

export const nodeAncestors = defineTool({
  name: 'node_ancestors',
  description: 'Get the ancestor chain from a node to the page root.',
  params: {
    id: { type: 'string', description: 'Node ID', required: true },
    depth: { type: 'number', description: 'Max depth to traverse' }
  },
  execute: (figma, args) => {
    const node = figma.getNodeById(args.id)
    if (!node) return { error: `Node "${args.id}" not found` }
    const ancestors: { id: string; name: string; type: string }[] = []
    let current = node.parent
    let d = 0
    while (current && (!args.depth || d < args.depth)) {
      ancestors.push({ id: current.id, name: current.name, type: current.type })
      current = current.parent
      d++
    }
    return { id: args.id, ancestors }
  }
})

export const nodeChildren = defineTool({
  name: 'node_children',
  description: 'Get direct children of a node.',
  params: {
    id: { type: 'string', description: 'Node ID', required: true }
  },
  execute: (figma, { id }) => {
    const node = figma.getNodeById(id)
    if (!node) return { error: `Node "${id}" not found` }
    return {
      id,
      children: node.children.map((c) => ({ id: c.id, name: c.name, type: c.type }))
    }
  }
})

export const nodeTree = defineTool({
  name: 'node_tree',
  description: 'Get a node tree with types and hierarchy.',
  params: {
    id: { type: 'string', description: 'Node ID', required: true },
    depth: { type: 'number', description: 'Max depth (default: unlimited)' }
  },
  execute: (figma, args) => {
    const node = figma.getNodeById(args.id)
    if (!node) return { error: `Node "${args.id}" not found` }
    function buildTree(n: FigmaNodeProxy, d: number): Record<string, unknown> {
      const result: Record<string, unknown> = { id: n.id, name: n.name, type: n.type }
      if (args.depth === undefined || d < args.depth) {
        const kids = n.children
        if (kids.length > 0) result.children = kids.map((c) => buildTree(c, d + 1))
      }
      return result
    }
    return buildTree(node, 0)
  }
})

export const nodeBindings = defineTool({
  name: 'node_bindings',
  description: 'Get variable bindings for a node.',
  params: {
    id: { type: 'string', description: 'Node ID', required: true }
  },
  execute: (figma, { id }) => {
    const raw = figma.graph.getNode(id)
    if (!raw) return { error: `Node "${id}" not found` }
    return { id, bindings: raw.boundVariables }
  }
})

export const nodeReplaceWith = defineTool({
  name: 'node_replace_with',
  mutates: true,
  description: 'Replace a node with JSX content.',
  params: {
    id: { type: 'string', description: 'Node ID to replace', required: true },
    jsx: { type: 'string', description: 'JSX string for the replacement', required: true }
  },
  execute: async (figma, args) => {
    const node = figma.getNodeById(args.id)
    if (!node) return { error: `Node "${args.id}" not found` }
    const parentId = node.parent?.id ?? figma.currentPageId
    const x = node.x
    const y = node.y
    node.remove()
    const { renderJSX } = await import('../render/render-jsx.js')
    const results = await renderJSX(figma.graph, args.jsx, { parentId, x, y })
    const result = results[0]
    return { id: result.id, name: result.name, type: result.type }
  }
})

export const arrangeNodes = defineTool({
  name: 'arrange',
  mutates: true,
  description:
    'Arrange top-level nodes on the canvas in a grid, row, or column layout. Useful after batch creation to tidy up overlapping frames.',
  params: {
    ids: { type: 'string[]', description: 'Node IDs to arrange (default: all top-level children)' },
    mode: {
      type: 'string',
      description: 'Layout mode',
      enum: ['grid', 'row', 'column'],
      default: 'grid'
    },
    gap: { type: 'number', description: 'Spacing between nodes (default: 40)' },
    cols: { type: 'number', description: 'Column count for grid mode (default: auto)' }
  },
  execute: (figma, args) => {
    const gap = args.gap ?? 40
    const mode = args.mode ?? 'grid'
    const page = figma.currentPage

    let nodes: FigmaNodeProxy[]
    if (args.ids && args.ids.length > 0) {
      nodes = args.ids
        .map((id) => figma.getNodeById(id))
        .filter((n): n is FigmaNodeProxy => n !== null)
    } else {
      nodes = [...page.children]
    }

    if (nodes.length === 0) return { error: 'No nodes to arrange' }
    const first = nodes[0]

    if (mode === 'row') {
      let x = first.x
      const y = first.y
      for (const node of nodes) {
        node.x = x
        node.y = y
        x += node.width + gap
      }
    } else if (mode === 'column') {
      const x = first.x
      let y = first.y
      for (const node of nodes) {
        node.x = x
        node.y = y
        y += node.height + gap
      }
    } else {
      const cols = args.cols ?? Math.ceil(Math.sqrt(nodes.length))
      const startX = first.x
      let x = startX
      let y = first.y
      let rowHeight = 0

      for (let i = 0; i < nodes.length; i++) {
        const node = nodes[i]
        if (i > 0 && i % cols === 0) {
          x = startX
          y += rowHeight + gap
          rowHeight = 0
        }
        node.x = x
        node.y = y
        x += node.width + gap
        rowHeight = Math.max(rowHeight, node.height)
      }
    }

    return { arranged: nodes.length, mode }
  }
})


interface BatchOp {
  id: string
  props: Record<string, unknown>
}

function str(v: unknown): string { return typeof v === 'string' ? v : '' }
function num(v: unknown): number { return typeof v === 'number' ? v : 0 }

function applyBatchProps(node: FigmaNodeProxy, p: Record<string, unknown>): string[] {
  const updated: string[] = []

  if (p.spacing !== undefined) { node.itemSpacing = num(p.spacing); updated.push('spacing') }
  if (p.padding !== undefined) {
    const v = num(p.padding)
    node.paddingTop = v; node.paddingRight = v; node.paddingBottom = v; node.paddingLeft = v
    updated.push('padding')
  }
  if (p.padding_horizontal !== undefined) {
    node.paddingLeft = num(p.padding_horizontal); node.paddingRight = num(p.padding_horizontal)
    updated.push('padding_horizontal')
  }
  if (p.padding_vertical !== undefined) {
    node.paddingTop = num(p.padding_vertical); node.paddingBottom = num(p.padding_vertical)
    updated.push('padding_vertical')
  }
  if (p.counter_align !== undefined) { node.counterAxisAlignItems = str(p.counter_align); updated.push('counter_align') }
  if (p.align !== undefined) { node.primaryAxisAlignItems = str(p.align); updated.push('align') }
  if (p.sizing_horizontal !== undefined) { node.layoutSizingHorizontal = str(p.sizing_horizontal); updated.push('sizing_horizontal') }
  if (p.sizing_vertical !== undefined) { node.layoutSizingVertical = str(p.sizing_vertical); updated.push('sizing_vertical') }
  if (p.grow !== undefined) { node.layoutGrow = num(p.grow); updated.push('grow') }
  if (p.name !== undefined) { node.name = str(p.name); updated.push('name') }
  if (p.visible !== undefined) { node.visible = Boolean(p.visible); updated.push('visible') }
  if (p.corner_radius !== undefined) { node.cornerRadius = num(p.corner_radius); updated.push('corner_radius') }
  if (p.opacity !== undefined) { node.opacity = num(p.opacity); updated.push('opacity') }
  if (p.auto_resize !== undefined) { node.textAutoResize = str(p.auto_resize); updated.push('auto_resize') }
  if (p.direction !== undefined) { node.layoutMode = str(p.direction) as 'HORIZONTAL' | 'VERTICAL'; updated.push('direction') }

  return updated
}

export const batchUpdate = defineTool({
  name: 'batch_update',
  mutates: true,
  description:
    'Execute multiple modifications in one call. Each operation is {id, props} where props can include: spacing, padding, padding_horizontal, padding_vertical, counter_align, sizing_horizontal, sizing_vertical, grow, name, visible, corner_radius, auto_resize (for text), direction. Runs all updates with one layout recompute.',
  params: {
    operations: {
      type: 'string',
      description:
        'JSON array: [{"id":"0:5","props":{"spacing":8}},{"id":"0:6","props":{"sizing_horizontal":"FILL","grow":1}}]',
      required: true
    }
  },
  execute: (figma, { operations }) => {
    let ops: BatchOp[]
    try {
      ops = JSON.parse(String(operations))
    } catch {
      return { error: 'Invalid JSON in operations' }
    }
    if (!Array.isArray(ops)) return { error: 'operations must be a JSON array' }

    const results: Array<{ id: string; updated: string[] }> = []
    const errors: string[] = []

    for (const op of ops) {
      const node = figma.getNodeById(op.id)
      if (!node) { errors.push(`Node "${op.id}" not found`); continue }
      const updated = applyBatchProps(node, op.props)
      if (updated.length > 0) results.push({ id: op.id, updated })
    }

    const out: Record<string, unknown> = { updated: results.length }
    if (results.length > 0) out.results = results
    if (errors.length > 0) out.errors = errors
    return out
  }
})
