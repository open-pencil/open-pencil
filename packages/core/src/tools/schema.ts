/**
 * Tool definition schema.
 *
 * Each tool is defined once with typed params and an execute function
 * that operates on FigmaAPI. Adapters for AI chat (valibot), CLI (citty),
 * and MCP (JSON Schema) are generated from these definitions.
 */

import { parseColor } from '../color'

import type { FigmaAPI, FigmaNodeProxy } from '../figma-api'
import type { Variable, VariableCollection, VariableType } from '../scene-graph'

export type ParamType = 'string' | 'number' | 'boolean' | 'color' | 'string[]'

export interface ParamDef {
  type: ParamType
  description: string
  required?: boolean
  default?: unknown
  enum?: string[]
  min?: number
  max?: number
}

export interface ToolDef {
  name: string
  description: string
  params: Record<string, ParamDef>
  execute: (figma: FigmaAPI, args: Record<string, any>) => unknown
}

type ResolvedType<T extends ParamType> = T extends 'string'
  ? string
  : T extends 'number'
    ? number
    : T extends 'boolean'
      ? boolean
      : T extends 'color'
        ? string
        : T extends 'string[]'
          ? string[]
          : never

type ResolvedParams<P extends Record<string, ParamDef>> = {
  [K in keyof P as P[K]['required'] extends true ? K : never]: ResolvedType<P[K]['type']>
} & {
  [K in keyof P as P[K]['required'] extends true ? never : K]?: ResolvedType<P[K]['type']>
}

export function defineTool<P extends Record<string, ParamDef>>(def: {
  name: string
  description: string
  params: P
  execute: (figma: FigmaAPI, args: ResolvedParams<P>) => unknown
}): ToolDef {
  return def as unknown as ToolDef
}

function nodeToResult(node: FigmaNodeProxy): Record<string, unknown> {
  return node.toJSON()
}

function nodeSummary(node: FigmaNodeProxy): { id: string; name: string; type: string } {
  return { id: node.id, name: node.name, type: node.type }
}

// ─── Read tools ───────────────────────────────────────────────

export const getSelection = defineTool({
  name: 'get_selection',
  description: 'Get details about currently selected nodes.',
  params: {},
  execute: (figma) => {
    const sel = figma.currentPage.selection
    return { selection: sel.map(nodeToResult) }
  }
})

export const getPageTree = defineTool({
  name: 'get_page_tree',
  description:
    'Get the node tree of the current page. Returns all nodes with hierarchy, types, positions, and sizes.',
  params: {},
  execute: (figma) => {
    const page = figma.currentPage
    return {
      page: page.name,
      children: page.children.map(nodeToResult)
    }
  }
})

export const getNode = defineTool({
  name: 'get_node',
  description: 'Get detailed properties of a node by ID.',
  params: {
    id: { type: 'string', description: 'Node ID', required: true }
  },
  execute: (figma, { id }) => {
    const node = figma.getNodeById(id)
    if (!node) return { error: `Node "${id}" not found` }
    return nodeToResult(node)
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

// ─── Create tools ─────────────────────────────────────────────

export const createShape = defineTool({
  name: 'create_shape',
  description:
    'Create a shape on the canvas. Use FRAME for containers/cards, RECTANGLE for solid blocks, ELLIPSE for circles, TEXT for labels, SECTION for page sections.',
  params: {
    type: {
      type: 'string',
      description: 'Node type',
      required: true,
      enum: ['FRAME', 'RECTANGLE', 'ELLIPSE', 'TEXT', 'LINE', 'STAR', 'POLYGON', 'SECTION']
    },
    x: { type: 'number', description: 'X position', required: true },
    y: { type: 'number', description: 'Y position', required: true },
    width: { type: 'number', description: 'Width in pixels', required: true, min: 1 },
    height: { type: 'number', description: 'Height in pixels', required: true, min: 1 },
    name: { type: 'string', description: 'Node name shown in layers panel' },
    parent_id: { type: 'string', description: 'Parent node ID to nest inside' }
  },
  execute: (figma, args) => {
    const parentId = args.parent_id
    const parent = parentId ? figma.getNodeById(parentId) : null
    const createMap: Record<string, () => FigmaNodeProxy> = {
      FRAME: () => figma.createFrame(),
      RECTANGLE: () => figma.createRectangle(),
      ELLIPSE: () => figma.createEllipse(),
      TEXT: () => figma.createText(),
      LINE: () => figma.createLine(),
      STAR: () => figma.createStar(),
      POLYGON: () => figma.createPolygon(),
      SECTION: () => figma.createSection()
    }
    const node = createMap[args.type]!()
    node.x = args.x
    node.y = args.y
    node.resize(args.width, args.height)
    if (args.name) node.name = args.name
    if (parent) parent.appendChild(node)
    return nodeSummary(node)
  }
})

export const render = defineTool({
  name: 'render',
  description:
    'Render JSX to design nodes. Primary creation tool — creates entire component trees in one call. Example: <Frame name="Card" w={320} h="hug" flex="col" gap={16} p={24} bg="#FFF" rounded={16}><Text size={18} weight="bold">Title</Text></Frame>',
  params: {
    jsx: { type: 'string', description: 'JSX string to render', required: true },
    x: { type: 'number', description: 'X position of the root node' },
    y: { type: 'number', description: 'Y position of the root node' },
    parent_id: { type: 'string', description: 'Parent node ID to render into' }
  },
  execute: async (figma, args) => {
    const { renderJsx } = await import('../render/render-jsx')
    const result = await renderJsx(figma.graph, args.jsx, {
      parentId: args.parent_id ?? figma.currentPageId,
      x: args.x,
      y: args.y
    })
    return { id: result.id, name: result.name, type: result.type, children: result.childIds }
  }
})

// ─── Modify tools ─────────────────────────────────────────────

export const setFill = defineTool({
  name: 'set_fill',
  description: 'Set the fill color of a node. Accepts hex (#ff0000) or named color.',
  params: {
    id: { type: 'string', description: 'Node ID', required: true },
    color: { type: 'color', description: 'Color value (hex like #ff0000)', required: true }
  },
  execute: (figma, { id, color }) => {
    const node = figma.getNodeById(id)
    if (!node) return { error: `Node "${id}" not found` }

    const c = parseColor(color)
    node.fills = [{ type: 'SOLID', color: c, opacity: 1, visible: true }]
    return { id, color: c }
  }
})

export const setStroke = defineTool({
  name: 'set_stroke',
  description: 'Set the stroke (border) of a node.',
  params: {
    id: { type: 'string', description: 'Node ID', required: true },
    color: { type: 'color', description: 'Stroke color (hex)', required: true },
    weight: { type: 'number', description: 'Stroke weight', default: 1, min: 0.1 },
    align: {
      type: 'string',
      description: 'Stroke alignment',
      default: 'INSIDE',
      enum: ['INSIDE', 'CENTER', 'OUTSIDE']
    }
  },
  execute: (figma, { id, color, weight, align }) => {
    const node = figma.getNodeById(id)
    if (!node) return { error: `Node "${id}" not found` }

    const c = parseColor(color)
    node.strokes = [
      {
        color: c,
        weight: weight ?? 1,
        opacity: 1,
        visible: true,
        align: (align ?? 'INSIDE') as 'INSIDE' | 'CENTER' | 'OUTSIDE'
      }
    ]
    return { id, color: c, weight: weight ?? 1 }
  }
})

export const setEffects = defineTool({
  name: 'set_effects',
  description:
    'Set effects on a node (drop shadow, inner shadow, blur). Pass an array or a single effect.',
  params: {
    id: { type: 'string', description: 'Node ID', required: true },
    type: {
      type: 'string',
      description: 'Effect type',
      required: true,
      enum: ['DROP_SHADOW', 'INNER_SHADOW', 'FOREGROUND_BLUR', 'BACKGROUND_BLUR']
    },
    color: { type: 'color', description: 'Shadow color (hex). Ignored for blur.' },
    offset_x: { type: 'number', description: 'Shadow X offset', default: 0 },
    offset_y: { type: 'number', description: 'Shadow Y offset', default: 4 },
    radius: { type: 'number', description: 'Blur radius', default: 4, min: 0 },
    spread: { type: 'number', description: 'Shadow spread', default: 0 }
  },
  execute: (figma, args) => {
    const node = figma.getNodeById(args.id)
    if (!node) return { error: `Node "${args.id}" not found` }

    const isBlur = args.type === 'FOREGROUND_BLUR' || args.type === 'BACKGROUND_BLUR'
    const effect: Record<string, unknown> = {
      type: args.type,
      visible: true,
      radius: args.radius ?? 4
    }

    if (!isBlur) {
      effect.color = args.color ? parseColor(args.color) : { r: 0, g: 0, b: 0, a: 0.25 }
      effect.offset = { x: args.offset_x ?? 0, y: args.offset_y ?? 4 }
      effect.spread = args.spread ?? 0
    }

    node.effects = [...node.effects, effect as any]
    return { id: args.id, effects: node.effects.length }
  }
})

export const updateNode = defineTool({
  name: 'update_node',
  description:
    'Update properties of an existing node: position, size, opacity, corner radius, visibility, text, font.',
  params: {
    id: { type: 'string', description: 'Node ID', required: true },
    x: { type: 'number', description: 'X position' },
    y: { type: 'number', description: 'Y position' },
    width: { type: 'number', description: 'Width', min: 1 },
    height: { type: 'number', description: 'Height', min: 1 },
    opacity: { type: 'number', description: 'Opacity (0-1)', min: 0, max: 1 },
    corner_radius: { type: 'number', description: 'Corner radius', min: 0 },
    visible: { type: 'boolean', description: 'Visibility' },
    text: { type: 'string', description: 'Text content (TEXT nodes)' },
    font_size: { type: 'number', description: 'Font size', min: 1 },
    font_weight: { type: 'number', description: 'Font weight (100-900)' },
    name: { type: 'string', description: 'Layer name' }
  },
  execute: (figma, args) => {
    const node = figma.getNodeById(args.id)
    if (!node) return { error: `Node "${args.id}" not found` }
    const updated: string[] = []
    if (args.x !== undefined) {
      node.x = args.x
      updated.push('x')
    }
    if (args.y !== undefined) {
      node.y = args.y
      updated.push('y')
    }
    if (args.width !== undefined || args.height !== undefined) {
      node.resize(args.width ?? node.width, args.height ?? node.height)
      updated.push('size')
    }
    if (args.opacity !== undefined) {
      node.opacity = args.opacity
      updated.push('opacity')
    }
    if (args.corner_radius !== undefined) {
      node.cornerRadius = args.corner_radius
      updated.push('cornerRadius')
    }
    if (args.visible !== undefined) {
      node.visible = args.visible
      updated.push('visible')
    }
    if (args.name !== undefined) {
      node.name = args.name
      updated.push('name')
    }
    if (args.text !== undefined) {
      figma.graph.updateNode(node.id, { text: args.text })
      updated.push('text')
    }
    if (args.font_size !== undefined) {
      figma.graph.updateNode(node.id, { fontSize: args.font_size })
      updated.push('fontSize')
    }
    if (args.font_weight !== undefined) {
      figma.graph.updateNode(node.id, { fontWeight: args.font_weight })
      updated.push('fontWeight')
    }
    return { id: args.id, updated }
  }
})

export const setLayout = defineTool({
  name: 'set_layout',
  description: 'Set auto-layout (flexbox) on a frame. Direction, alignment, spacing, padding.',
  params: {
    id: { type: 'string', description: 'Frame node ID', required: true },
    direction: {
      type: 'string',
      description: 'Layout direction',
      required: true,
      enum: ['HORIZONTAL', 'VERTICAL']
    },
    spacing: { type: 'number', description: 'Gap between items', default: 0, min: 0 },
    padding: { type: 'number', description: 'Equal padding on all sides', min: 0 },
    padding_horizontal: { type: 'number', description: 'Horizontal padding', min: 0 },
    padding_vertical: { type: 'number', description: 'Vertical padding', min: 0 },
    align: {
      type: 'string',
      description: 'Primary axis alignment',
      default: 'MIN',
      enum: ['MIN', 'CENTER', 'MAX', 'SPACE_BETWEEN']
    },
    counter_align: {
      type: 'string',
      description: 'Cross axis alignment',
      default: 'MIN',
      enum: ['MIN', 'CENTER', 'MAX', 'STRETCH']
    }
  },
  execute: (figma, args) => {
    const node = figma.getNodeById(args.id)
    if (!node) return { error: `Node "${args.id}" not found` }

    node.layoutMode = args.direction as 'HORIZONTAL' | 'VERTICAL'
    node.itemSpacing = args.spacing ?? 0
    node.primaryAxisAlignItems = (args.align ?? 'MIN') as any
    node.counterAxisAlignItems = (args.counter_align ?? 'MIN') as any

    const ph = args.padding_horizontal ?? args.padding ?? 0
    const pv = args.padding_vertical ?? args.padding ?? 0
    node.paddingLeft = ph
    node.paddingRight = ph
    node.paddingTop = pv
    node.paddingBottom = pv

    return { id: args.id, direction: args.direction, spacing: args.spacing ?? 0 }
  }
})

export const setConstraints = defineTool({
  name: 'set_constraints',
  description: 'Set resize constraints for a node within its parent.',
  params: {
    id: { type: 'string', description: 'Node ID', required: true },
    horizontal: {
      type: 'string',
      description: 'Horizontal constraint',
      enum: ['MIN', 'CENTER', 'MAX', 'STRETCH', 'SCALE']
    },
    vertical: {
      type: 'string',
      description: 'Vertical constraint',
      enum: ['MIN', 'CENTER', 'MAX', 'STRETCH', 'SCALE']
    }
  },
  execute: (figma, args) => {
    const node = figma.getNodeById(args.id)
    if (!node) return { error: `Node "${args.id}" not found` }
    if (args.horizontal || args.vertical) {
      node.constraints = {
        horizontal: args.horizontal ?? node.constraints.horizontal,
        vertical: args.vertical ?? node.constraints.vertical
      }
    }
    return { id: args.id, constraints: node.constraints }
  }
})

// ─── Structure tools ──────────────────────────────────────────

export const deleteNode = defineTool({
  name: 'delete_node',
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

export const selectNodes = defineTool({
  name: 'select_nodes',
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

export const groupNodes = defineTool({
  name: 'group_nodes',
  description: 'Group selected nodes.',
  params: {
    ids: { type: 'string[]', description: 'Node IDs to group', required: true }
  },
  execute: (figma, { ids }) => {
    const nodes = ids
      .map((id) => figma.getNodeById(id))
      .filter((n): n is FigmaNodeProxy => n !== null)
    if (nodes.length < 2) return { error: 'Need at least 2 nodes to group' }
    const parent = nodes[0]!.parent ?? figma.currentPage
    const group = figma.group(nodes, parent)
    return nodeSummary(group)
  }
})

export const ungroupNode = defineTool({
  name: 'ungroup_node',
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

// ─── Component tools ──────────────────────────────────────────

export const createComponent = defineTool({
  name: 'create_component',
  description: 'Convert a frame/group into a component.',
  params: {
    id: { type: 'string', description: 'Node ID to convert', required: true }
  },
  execute: (figma, { id }) => {
    const node = figma.getNodeById(id)
    if (!node) return { error: `Node "${id}" not found` }
    const comp = figma.createComponentFromNode(node)
    return nodeSummary(comp)
  }
})

export const createInstance = defineTool({
  name: 'create_instance',
  description: 'Create an instance of a component.',
  params: {
    component_id: { type: 'string', description: 'Component node ID', required: true },
    x: { type: 'number', description: 'X position' },
    y: { type: 'number', description: 'Y position' }
  },
  execute: (figma, args) => {
    const comp = figma.getNodeById(args.component_id)
    if (!comp) return { error: `Component "${args.component_id}" not found` }
    const instance = comp.createInstance()
    if (args.x !== undefined) instance.x = args.x
    if (args.y !== undefined) instance.y = args.y
    return nodeSummary(instance)
  }
})

// ─── Page tools ───────────────────────────────────────────────

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

// ─── Variable tools ───────────────────────────────────────────

export const listVariables = defineTool({
  name: 'list_variables',
  description: 'List all design variables (colors, numbers, strings, booleans).',
  params: {
    type: {
      type: 'string',
      description: 'Filter by variable type',
      enum: ['COLOR', 'FLOAT', 'STRING', 'BOOLEAN']
    }
  },
  execute: (figma, args) => {
    const vars = figma.getLocalVariables(args.type)
    return { count: vars.length, variables: vars }
  }
})

export const listCollections = defineTool({
  name: 'list_collections',
  description: 'List all variable collections.',
  params: {},
  execute: (figma) => {
    const cols = figma.getLocalVariableCollections()
    return { count: cols.length, collections: cols }
  }
})

// ─── Eval escape hatch ────────────────────────────────────────

export const evalCode = defineTool({
  name: 'eval',
  description:
    'Execute JavaScript with full Figma Plugin API access. Use for operations not covered by other tools. The `figma` global is available.',
  params: {
    code: { type: 'string', description: 'JavaScript code to execute', required: true }
  },
  execute: async (figma, { code }) => {
    const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor
    const wrapped = code.trim().startsWith('return') ? code : `return (async () => { ${code} })()`
    const fn = new AsyncFunction('figma', wrapped)
    const result = await fn(figma)
    if (result && typeof result === 'object' && 'toJSON' in result) return result.toJSON()
    return result ?? null
  }
})

// ─── Tree navigation tools ────────────────────────────────────

export const getChildren = defineTool({
  name: 'get_children',
  description: 'Get the direct children of a node.',
  params: {
    id: { type: 'string', description: 'Parent node ID', required: true }
  },
  execute: (figma, { id }) => {
    const node = figma.getNodeById(id)
    if (!node) return { error: `Node "${id}" not found` }
    const children = figma.graph.getChildren(id)
    return {
      id,
      childCount: children.length,
      children: children.map((c) => ({ id: c.id, name: c.name, type: c.type }))
    }
  }
})

export const getAncestors = defineTool({
  name: 'get_ancestors',
  description: 'Get the ancestor chain of a node from its parent up to the page root.',
  params: {
    id: { type: 'string', description: 'Node ID', required: true }
  },
  execute: (figma, { id }) => {
    if (!figma.getNodeById(id)) return { error: `Node "${id}" not found` }
    const ancestors: { id: string; name: string; type: string }[] = []
    let raw = figma.graph.getNode(id)
    while (raw?.parentId) {
      const parent = figma.graph.getNode(raw.parentId)
      if (!parent) break
      ancestors.push({ id: parent.id, name: parent.name, type: parent.type })
      raw = parent
    }
    return { id, ancestors }
  }
})

export const nodeBounds = defineTool({
  name: 'node_bounds',
  description: 'Get the absolute bounding box of a node in canvas space.',
  params: {
    id: { type: 'string', description: 'Node ID', required: true }
  },
  execute: (figma, { id }) => {
    const node = figma.getNodeById(id)
    if (!node) return { error: `Node "${id}" not found` }
    const bounds = node.absoluteBoundingBox
    return { id, x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height }
  }
})

// ─── Text tools ───────────────────────────────────────────────

export const setText = defineTool({
  name: 'set_text',
  description: 'Set the text content of a TEXT node.',
  params: {
    id: { type: 'string', description: 'Text node ID', required: true },
    text: { type: 'string', description: 'New text content', required: true }
  },
  execute: (figma, { id, text }) => {
    const node = figma.getNodeById(id)
    if (!node) return { error: `Node "${id}" not found` }
    if (node.type !== 'TEXT') return { error: `Node "${id}" is not a TEXT node` }
    node.characters = text
    return { id, text }
  }
})

export const setFont = defineTool({
  name: 'set_font',
  description: 'Set font properties on a TEXT node: family, size, weight, line height, letter spacing.',
  params: {
    id: { type: 'string', description: 'Text node ID', required: true },
    family: { type: 'string', description: 'Font family name, e.g. "Inter"' },
    size: { type: 'number', description: 'Font size in pixels', min: 1 },
    weight: {
      type: 'number',
      description: 'Font weight: 100 (thin) → 900 (black)',
      min: 100,
      max: 900
    },
    italic: { type: 'boolean', description: 'Italic style' },
    line_height: { type: 'number', description: 'Line height in pixels (null = auto)', min: 0 },
    letter_spacing: { type: 'number', description: 'Letter spacing in pixels' }
  },
  execute: (figma, args) => {
    const node = figma.getNodeById(args.id)
    if (!node) return { error: `Node "${args.id}" not found` }
    if (node.type !== 'TEXT') return { error: `Node "${args.id}" is not a TEXT node` }
    const updated: string[] = []
    if (args.family !== undefined || args.weight !== undefined || args.italic !== undefined) {
      const current = node.fontName
      node.fontName = {
        family: args.family ?? current.family,
        style: buildFontStyle(args.weight ?? node.fontWeight, args.italic ?? false)
      }
      updated.push('fontName')
    }
    if (args.size !== undefined) {
      node.fontSize = args.size
      updated.push('fontSize')
    }
    if (args.line_height !== undefined) {
      node.lineHeight = args.line_height
      updated.push('lineHeight')
    }
    if (args.letter_spacing !== undefined) {
      node.letterSpacing = args.letter_spacing
      updated.push('letterSpacing')
    }
    return { id: args.id, updated }
  }
})

function buildFontStyle(weight: number, italic: boolean): string {
  const names: Record<number, string> = {
    100: 'Thin', 200: 'Extra Light', 300: 'Light', 400: 'Regular',
    500: 'Medium', 600: 'Semi Bold', 700: 'Bold', 800: 'Extra Bold', 900: 'Black'
  }
  const base = names[weight] ?? 'Regular'
  return italic ? `${base} Italic` : base
}

export const setTextProperties = defineTool({
  name: 'set_text_properties',
  description:
    'Set text layout properties: alignment, auto-resize, text case, decoration, truncation.',
  params: {
    id: { type: 'string', description: 'Text node ID', required: true },
    align_horizontal: {
      type: 'string',
      description: 'Horizontal text alignment',
      enum: ['LEFT', 'CENTER', 'RIGHT', 'JUSTIFIED']
    },
    align_vertical: {
      type: 'string',
      description: 'Vertical text alignment',
      enum: ['TOP', 'CENTER', 'BOTTOM']
    },
    auto_resize: {
      type: 'string',
      description: 'Text auto-resize mode',
      enum: ['NONE', 'WIDTH_AND_HEIGHT', 'HEIGHT', 'TRUNCATE']
    },
    text_case: {
      type: 'string',
      description: 'Text case transform',
      enum: ['ORIGINAL', 'UPPER', 'LOWER', 'TITLE', 'SMALL_CAPS', 'SMALL_CAPS_FORCED']
    },
    text_decoration: {
      type: 'string',
      description: 'Text decoration',
      enum: ['NONE', 'UNDERLINE', 'STRIKETHROUGH']
    },
    max_lines: { type: 'number', description: 'Max visible lines (null = unlimited)', min: 1 }
  },
  execute: (figma, args) => {
    const node = figma.getNodeById(args.id)
    if (!node) return { error: `Node "${args.id}" not found` }
    if (node.type !== 'TEXT') return { error: `Node "${args.id}" is not a TEXT node` }
    const updated: string[] = []
    if (args.align_horizontal !== undefined) {
      node.textAlignHorizontal = args.align_horizontal
      updated.push('textAlignHorizontal')
    }
    if (args.align_vertical !== undefined) {
      node.textAlignVertical = args.align_vertical
      updated.push('textAlignVertical')
    }
    if (args.auto_resize !== undefined) {
      node.textAutoResize = args.auto_resize
      updated.push('textAutoResize')
    }
    if (args.text_case !== undefined) {
      node.textCase = args.text_case
      updated.push('textCase')
    }
    if (args.text_decoration !== undefined) {
      node.textDecoration = args.text_decoration
      updated.push('textDecoration')
    }
    if (args.max_lines !== undefined) {
      node.maxLines = args.max_lines
      updated.push('maxLines')
    }
    return { id: args.id, updated }
  }
})

// ─── Appearance tools ─────────────────────────────────────────

export const setBlendMode = defineTool({
  name: 'set_blend_mode',
  description: 'Set the blend mode and/or rotation of a node.',
  params: {
    id: { type: 'string', description: 'Node ID', required: true },
    blend_mode: {
      type: 'string',
      description: 'CSS-style blend mode',
      enum: [
        'NORMAL', 'DARKEN', 'MULTIPLY', 'LINEAR_BURN', 'COLOR_BURN',
        'LIGHTEN', 'SCREEN', 'LINEAR_DODGE', 'COLOR_DODGE',
        'OVERLAY', 'SOFT_LIGHT', 'HARD_LIGHT',
        'DIFFERENCE', 'EXCLUSION',
        'HUE', 'SATURATION', 'COLOR', 'LUMINOSITY',
        'PASS_THROUGH'
      ]
    },
    rotation: { type: 'number', description: 'Rotation in degrees', min: -180, max: 180 }
  },
  execute: (figma, args) => {
    const node = figma.getNodeById(args.id)
    if (!node) return { error: `Node "${args.id}" not found` }
    const updated: string[] = []
    if (args.blend_mode !== undefined) {
      node.blendMode = args.blend_mode
      updated.push('blendMode')
    }
    if (args.rotation !== undefined) {
      node.rotation = args.rotation
      updated.push('rotation')
    }
    return { id: args.id, updated }
  }
})

// ─── Layout child tools ───────────────────────────────────────

export const setLayoutChild = defineTool({
  name: 'set_layout_child',
  description:
    'Configure auto-layout child behaviour: sizing (FIXED/HUG/FILL), grow, alignment, absolute positioning.',
  params: {
    id: { type: 'string', description: 'Child node ID', required: true },
    sizing_horizontal: {
      type: 'string',
      description: 'Horizontal sizing mode',
      enum: ['FIXED', 'HUG', 'FILL']
    },
    sizing_vertical: {
      type: 'string',
      description: 'Vertical sizing mode',
      enum: ['FIXED', 'HUG', 'FILL']
    },
    grow: { type: 'number', description: 'Flex grow factor (0 = no grow, 1 = grow)', min: 0 },
    align_self: {
      type: 'string',
      description: 'Self alignment override',
      enum: ['INHERIT', 'STRETCH']
    },
    positioning: {
      type: 'string',
      description: 'ABSOLUTE to take node out of auto-layout flow',
      enum: ['AUTO', 'ABSOLUTE']
    }
  },
  execute: (figma, args) => {
    const node = figma.getNodeById(args.id)
    if (!node) return { error: `Node "${args.id}" not found` }
    const updated: string[] = []
    if (args.sizing_horizontal !== undefined) {
      node.layoutSizingHorizontal = args.sizing_horizontal
      updated.push('layoutSizingHorizontal')
    }
    if (args.sizing_vertical !== undefined) {
      node.layoutSizingVertical = args.sizing_vertical
      updated.push('layoutSizingVertical')
    }
    if (args.grow !== undefined) {
      node.layoutGrow = args.grow
      updated.push('layoutGrow')
    }
    if (args.align_self !== undefined) {
      node.layoutAlign = args.align_self
      updated.push('layoutAlign')
    }
    if (args.positioning !== undefined) {
      node.layoutPositioning = args.positioning
      updated.push('layoutPositioning')
    }
    return { id: args.id, updated }
  }
})

// ─── Page tools ───────────────────────────────────────────────

export const createPage = defineTool({
  name: 'create_page',
  description: 'Create a new page in the document.',
  params: {
    name: { type: 'string', description: 'Page name', required: true }
  },
  execute: (figma, { name }) => {
    const page = figma.createPage()
    page.name = name
    return { id: page.id, name: page.name }
  }
})

// ─── Variable tools ───────────────────────────────────────────

export const createVariable = defineTool({
  name: 'create_variable',
  description:
    'Create a design variable. If no collection_id is given, creates a default "Variables" collection.',
  params: {
    name: { type: 'string', description: 'Variable name', required: true },
    type: {
      type: 'string',
      description: 'Variable type',
      required: true,
      enum: ['COLOR', 'FLOAT', 'STRING', 'BOOLEAN']
    },
    value: {
      type: 'string',
      description:
        'Initial value. COLOR: hex string. FLOAT: number. STRING: text. BOOLEAN: "true"/"false".',
      required: true
    },
    collection_id: { type: 'string', description: 'Collection ID to add variable to' }
  },
  execute: (figma, args) => {
    let collectionId = args.collection_id
    if (!collectionId) {
      const existing = [...figma.graph.variableCollections.values()]
      if (existing.length > 0) {
        collectionId = existing[0].id
      } else {
        const modeId = crypto.randomUUID()
        const col: VariableCollection = {
          id: crypto.randomUUID(),
          name: 'Variables',
          modes: [{ modeId, name: 'Default' }],
          defaultModeId: modeId,
          variableIds: []
        }
        figma.graph.addCollection(col)
        collectionId = col.id
      }
    }
    const collection = figma.graph.variableCollections.get(collectionId)
    if (!collection) return { error: `Collection "${collectionId}" not found` }
    const modeId = collection.defaultModeId
    const parsedValue = parseVariableValue(args.type as VariableType, args.value)
    const variable: Variable = {
      id: crypto.randomUUID(),
      name: args.name,
      type: args.type as VariableType,
      collectionId,
      valuesByMode: { [modeId]: parsedValue },
      description: '',
      hiddenFromPublishing: false
    }
    figma.graph.addVariable(variable)
    return { id: variable.id, name: variable.name, type: variable.type, collectionId }
  }
})

export const setVariableValue = defineTool({
  name: 'set_variable_value',
  description: "Set a variable's value for its default mode.",
  params: {
    id: { type: 'string', description: 'Variable ID', required: true },
    value: {
      type: 'string',
      description:
        'New value. COLOR: hex string. FLOAT: number. STRING: text. BOOLEAN: "true"/"false".',
      required: true
    },
    mode_id: {
      type: 'string',
      description: "Mode ID to set value for (defaults to collection's default mode)"
    }
  },
  execute: (figma, args) => {
    const variable = figma.graph.variables.get(args.id)
    if (!variable) return { error: `Variable "${args.id}" not found` }
    const modeId = args.mode_id ?? figma.graph.getActiveModeId(variable.collectionId)
    variable.valuesByMode[modeId] = parseVariableValue(variable.type, args.value)
    return { id: args.id, modeId, value: variable.valuesByMode[modeId] }
  }
})

export const bindVariable = defineTool({
  name: 'bind_variable',
  description:
    'Bind a node property to a design variable. Common fields: "opacity", "fills.0.opacity", "width", "height".',
  params: {
    node_id: { type: 'string', description: 'Node ID', required: true },
    field: {
      type: 'string',
      description: 'Property field path to bind (e.g. "opacity", "fills.0.opacity")',
      required: true
    },
    variable_id: { type: 'string', description: 'Variable ID to bind', required: true }
  },
  execute: (figma, { node_id, field, variable_id }) => {
    if (!figma.getNodeById(node_id)) return { error: `Node "${node_id}" not found` }
    if (!figma.graph.variables.get(variable_id))
      return { error: `Variable "${variable_id}" not found` }
    figma.graph.bindVariable(node_id, field, variable_id)
    return { node_id, field, variable_id }
  }
})

function parseVariableValue(
  type: VariableType,
  raw: string
): Variable['valuesByMode'][string] {
  switch (type) {
    case 'COLOR':
      return parseColor(raw)
    case 'FLOAT':
      return Number(raw)
    case 'BOOLEAN':
      return raw === 'true'
    case 'STRING':
    default:
      return raw
  }
}

// ─── Registry ─────────────────────────────────────────────────

export const ALL_TOOLS: ToolDef[] = [
  // Read
  getSelection,
  getPageTree,
  getNode,
  findNodes,
  getChildren,
  getAncestors,
  nodeBounds,
  // Create
  createShape,
  createPage,
  render,
  // Fill / stroke / effects
  setFill,
  setStroke,
  setEffects,
  // Node mutation
  updateNode,
  setText,
  setFont,
  setTextProperties,
  setBlendMode,
  setLayout,
  setLayoutChild,
  setConstraints,
  // Structure
  deleteNode,
  cloneNode,
  renameNode,
  reparentNode,
  selectNodes,
  groupNodes,
  ungroupNode,
  createComponent,
  createInstance,
  // Pages
  listPages,
  switchPage,
  // Variables
  listVariables,
  listCollections,
  createVariable,
  setVariableValue,
  bindVariable,
  // Escape hatch
  evalCode
]
