/**
 * Tool definition schema.
 *
 * Each tool is defined once with typed params and an execute function
 * that operates on FigmaAPI. Adapters for AI chat (valibot), CLI (citty),
 * and MCP (JSON Schema) are generated from these definitions.
 */

import type { FigmaAPI, FigmaNodeProxy } from '../figma-api'

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
  mutates?: boolean
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
  mutates?: boolean
  params: P
  execute: (figma: FigmaAPI, args: ResolvedParams<P>) => unknown
}): ToolDef {
  return def as unknown as ToolDef
}

export function nodeToResult(node: FigmaNodeProxy): Record<string, unknown> {
  return node.toJSON()
}

export function nodeSummary(node: FigmaNodeProxy): { id: string; name: string; type: string } {
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
    const { renderJSX } = await import('../render/render-jsx.js')
    const result = await renderJSX(figma.graph, args.jsx, {
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
      effect.color = args.color ? parseColor(args.color) : { ...DEFAULT_SHADOW_COLOR }
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

// ─── Granular set tools ───────────────────────────────────────

export const setRotation = defineTool({
  name: 'set_rotation',
  description: 'Set rotation angle of a node in degrees.',
  params: {
    id: { type: 'string', description: 'Node ID', required: true },
    angle: { type: 'number', description: 'Rotation angle in degrees', required: true }
  },
  execute: (figma, { id, angle }) => {
    const node = figma.getNodeById(id)
    if (!node) return { error: `Node "${id}" not found` }
    node.rotation = angle
    return { id, rotation: angle }
  }
})

export const setOpacity = defineTool({
  name: 'set_opacity',
  description: 'Set opacity of a node (0-1).',
  params: {
    id: { type: 'string', description: 'Node ID', required: true },
    value: { type: 'number', description: 'Opacity (0-1)', required: true, min: 0, max: 1 }
  },
  execute: (figma, { id, value }) => {
    const node = figma.getNodeById(id)
    if (!node) return { error: `Node "${id}" not found` }
    node.opacity = value
    return { id, opacity: value }
  }
})

export const setRadius = defineTool({
  name: 'set_radius',
  description: 'Set corner radius. Use individual corners for independent values.',
  params: {
    id: { type: 'string', description: 'Node ID', required: true },
    radius: { type: 'number', description: 'Corner radius for all corners', min: 0 },
    top_left: { type: 'number', description: 'Top-left radius', min: 0 },
    top_right: { type: 'number', description: 'Top-right radius', min: 0 },
    bottom_right: { type: 'number', description: 'Bottom-right radius', min: 0 },
    bottom_left: { type: 'number', description: 'Bottom-left radius', min: 0 }
  },
  execute: (figma, args) => {
    const node = figma.getNodeById(args.id)
    if (!node) return { error: `Node "${args.id}" not found` }
    if (args.radius !== undefined) {
      node.cornerRadius = args.radius
    }
    if (args.top_left !== undefined) node.topLeftRadius = args.top_left
    if (args.top_right !== undefined) node.topRightRadius = args.top_right
    if (args.bottom_right !== undefined) node.bottomRightRadius = args.bottom_right
    if (args.bottom_left !== undefined) node.bottomLeftRadius = args.bottom_left
    return { id: args.id, cornerRadius: node.cornerRadius }
  }
})

export const setMinMax = defineTool({
  name: 'set_minmax',
  description: 'Set min/max width and height constraints on a node.',
  params: {
    id: { type: 'string', description: 'Node ID', required: true },
    min_width: { type: 'number', description: 'Minimum width', min: 0 },
    max_width: { type: 'number', description: 'Maximum width', min: 0 },
    min_height: { type: 'number', description: 'Minimum height', min: 0 },
    max_height: { type: 'number', description: 'Maximum height', min: 0 }
  },
  execute: (figma, args) => {
    const node = figma.getNodeById(args.id)
    if (!node) return { error: `Node "${args.id}" not found` }
    if (args.min_width !== undefined) node.minWidth = args.min_width
    if (args.max_width !== undefined) node.maxWidth = args.max_width
    if (args.min_height !== undefined) node.minHeight = args.min_height
    if (args.max_height !== undefined) node.maxHeight = args.max_height
    return {
      id: args.id,
      minWidth: node.minWidth,
      maxWidth: node.maxWidth,
      minHeight: node.minHeight,
      maxHeight: node.maxHeight
    }
  }
})

export const setText = defineTool({
  name: 'set_text',
  description: 'Set text content of a text node.',
  params: {
    id: { type: 'string', description: 'Node ID', required: true },
    text: { type: 'string', description: 'Text content', required: true }
  },
  execute: (figma, { id, text }) => {
    const node = figma.getNodeById(id)
    if (!node) return { error: `Node "${id}" not found` }
    node.characters = text
    return { id, text }
  }
})

export const setFont = defineTool({
  name: 'set_font',
  description: 'Set font properties of a text node.',
  params: {
    id: { type: 'string', description: 'Node ID', required: true },
    family: { type: 'string', description: 'Font family name' },
    size: { type: 'number', description: 'Font size', min: 1 },
    style: { type: 'string', description: 'Font style (e.g. "Bold", "Regular", "Bold Italic")' }
  },
  execute: (figma, args) => {
    const node = figma.getNodeById(args.id)
    if (!node) return { error: `Node "${args.id}" not found` }
    if (args.size !== undefined) node.fontSize = args.size
    if (args.family || args.style) {
      const current = node.fontName
      node.fontName = {
        family: args.family ?? current.family,
        style: args.style ?? current.style
      }
    }
    return { id: args.id, fontName: node.fontName, fontSize: node.fontSize }
  }
})

export const setFontRange = defineTool({
  name: 'set_font_range',
  description: 'Set font properties for a text range.',
  params: {
    id: { type: 'string', description: 'Node ID', required: true },
    start: { type: 'number', description: 'Start character index', required: true, min: 0 },
    end: { type: 'number', description: 'End character index', required: true, min: 0 },
    family: { type: 'string', description: 'Font family name' },
    size: { type: 'number', description: 'Font size', min: 1 },
    style: { type: 'string', description: 'Font style' },
    color: { type: 'color', description: 'Text color (hex)' }
  },
  execute: (figma, args) => {
    const node = figma.getNodeById(args.id)
    if (!node) return { error: `Node "${args.id}" not found` }
    const run: Record<string, unknown> = { start: args.start, end: args.end }
    if (args.family) run.fontFamily = args.family
    if (args.size) run.fontSize = args.size
    if (args.style) run.fontStyle = args.style
    if (args.color) run.color = parseColor(args.color)
    figma.graph.updateNode(node.id, {
      styleRuns: [...(figma.graph.getNode(node.id)?.styleRuns ?? []), run as any]
    })
    return { id: args.id, range: { start: args.start, end: args.end } }
  }
})

export const setTextResize = defineTool({
  name: 'set_text_resize',
  description: 'Set text auto-resize mode.',
  params: {
    id: { type: 'string', description: 'Node ID', required: true },
    mode: {
      type: 'string',
      description: 'Resize mode',
      required: true,
      enum: ['NONE', 'WIDTH_AND_HEIGHT', 'HEIGHT', 'TRUNCATE']
    }
  },
  execute: (figma, { id, mode }) => {
    const node = figma.getNodeById(id)
    if (!node) return { error: `Node "${id}" not found` }
    node.textAutoResize = mode
    return { id, textAutoResize: mode }
  }
})

export const setVisible = defineTool({
  name: 'set_visible',
  description: 'Set visibility of a node.',
  params: {
    id: { type: 'string', description: 'Node ID', required: true },
    value: { type: 'boolean', description: 'Visible (true/false)', required: true }
  },
  execute: (figma, { id, value }) => {
    const node = figma.getNodeById(id)
    if (!node) return { error: `Node "${id}" not found` }
    node.visible = value
    return { id, visible: value }
  }
})

export const setBlend = defineTool({
  name: 'set_blend',
  description: 'Set blend mode of a node.',
  params: {
    id: { type: 'string', description: 'Node ID', required: true },
    mode: {
      type: 'string',
      description: 'Blend mode',
      required: true,
      enum: [
        'NORMAL',
        'DARKEN',
        'MULTIPLY',
        'COLOR_BURN',
        'LIGHTEN',
        'SCREEN',
        'COLOR_DODGE',
        'OVERLAY',
        'SOFT_LIGHT',
        'HARD_LIGHT',
        'DIFFERENCE',
        'EXCLUSION',
        'HUE',
        'SATURATION',
        'COLOR',
        'LUMINOSITY'
      ]
    }
  },
  execute: (figma, { id, mode }) => {
    const node = figma.getNodeById(id)
    if (!node) return { error: `Node "${id}" not found` }
    node.blendMode = mode
    return { id, blendMode: mode }
  }
})

export const setLocked = defineTool({
  name: 'set_locked',
  description: 'Set locked state of a node.',
  params: {
    id: { type: 'string', description: 'Node ID', required: true },
    value: { type: 'boolean', description: 'Locked (true/false)', required: true }
  },
  execute: (figma, { id, value }) => {
    const node = figma.getNodeById(id)
    if (!node) return { error: `Node "${id}" not found` }
    node.locked = value
    return { id, locked: value }
  }
})

export const setStrokeAlign = defineTool({
  name: 'set_stroke_align',
  description: 'Set stroke alignment of a node.',
  params: {
    id: { type: 'string', description: 'Node ID', required: true },
    align: {
      type: 'string',
      description: 'Stroke alignment',
      required: true,
      enum: ['INSIDE', 'CENTER', 'OUTSIDE']
    }
  },
  execute: (figma, { id, align }) => {
    const node = figma.getNodeById(id)
    if (!node) return { error: `Node "${id}" not found` }
    node.strokeAlign = align
    return { id, strokeAlign: align }
  }
})

// ─── Node operation tools ─────────────────────────────────────

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
    let node = figma.getNodeById(args.id)
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
    const result = await renderJSX(figma.graph, args.jsx, { parentId, x, y })
    return { id: result.id, name: result.name, type: result.type }
  }
})

// ─── Variable CRUD tools ──────────────────────────────────────

export const getVariable = defineTool({
  name: 'get_variable',
  description: 'Get a variable by ID.',
  params: {
    id: { type: 'string', description: 'Variable ID', required: true }
  },
  execute: (figma, { id }) => {
    const v = figma.getVariableById(id)
    if (!v) return { error: `Variable "${id}" not found` }
    return v
  }
})

export const findVariables = defineTool({
  name: 'find_variables',
  description: 'Find variables by name pattern.',
  params: {
    query: { type: 'string', description: 'Name substring (case-insensitive)', required: true },
    type: {
      type: 'string',
      description: 'Filter by type',
      enum: ['COLOR', 'FLOAT', 'STRING', 'BOOLEAN']
    }
  },
  execute: (figma, args) => {
    let vars = figma.getLocalVariables(args.type)
    vars = vars.filter((v) => v.name.toLowerCase().includes(args.query.toLowerCase()))
    return { count: vars.length, variables: vars }
  }
})

export const createVariable = defineTool({
  name: 'create_variable',
  description: 'Create a new variable in a collection.',
  params: {
    name: { type: 'string', description: 'Variable name', required: true },
    type: {
      type: 'string',
      description: 'Variable type',
      required: true,
      enum: ['COLOR', 'FLOAT', 'STRING', 'BOOLEAN']
    },
    collection_id: { type: 'string', description: 'Collection ID', required: true },
    value: { type: 'string', description: 'Initial value (hex for COLOR, number for FLOAT, etc.)' }
  },
  execute: (figma, args) => {
    let parsedValue: unknown
    if (args.value !== undefined) {
      if (args.type === 'COLOR') parsedValue = parseColor(args.value)
      else if (args.type === 'FLOAT') parsedValue = Number(args.value)
      else if (args.type === 'BOOLEAN') parsedValue = args.value === 'true'
      else parsedValue = args.value
    }
    const v = figma.createVariable(
      args.name,
      args.type as any,
      args.collection_id,
      parsedValue as any
    )
    return v
  }
})

export const setVariable = defineTool({
  name: 'set_variable',
  description: 'Set the value of a variable for a specific mode.',
  params: {
    id: { type: 'string', description: 'Variable ID', required: true },
    mode: { type: 'string', description: 'Mode ID', required: true },
    value: {
      type: 'string',
      description: 'Value (hex for COLOR, number for FLOAT, etc.)',
      required: true
    }
  },
  execute: (figma, args) => {
    const v = figma.getVariableById(args.id)
    if (!v) return { error: `Variable "${args.id}" not found` }
    let parsedValue: unknown
    if (v.type === 'COLOR') parsedValue = parseColor(args.value)
    else if (v.type === 'FLOAT') parsedValue = Number(args.value)
    else if (v.type === 'BOOLEAN') parsedValue = args.value === 'true'
    else parsedValue = args.value
    figma.setVariableValue(args.id, args.mode, parsedValue as any)
    return { id: args.id, mode: args.mode, value: parsedValue }
  }
})

export const deleteVariable = defineTool({
  name: 'delete_variable',
  description: 'Delete a variable.',
  params: {
    id: { type: 'string', description: 'Variable ID', required: true }
  },
  execute: (figma, { id }) => {
    figma.deleteVariable(id)
    return { deleted: id }
  }
})

export const bindVariable = defineTool({
  name: 'bind_variable',
  description: 'Bind a variable to a node property (fills, strokes, opacity, width, height, etc.).',
  params: {
    node_id: { type: 'string', description: 'Node ID', required: true },
    field: {
      type: 'string',
      description: 'Property field (fills, strokes, opacity, width, height, etc.)',
      required: true
    },
    variable_id: { type: 'string', description: 'Variable ID', required: true }
  },
  execute: (figma, args) => {
    const node = figma.getNodeById(args.node_id)
    if (!node) return { error: `Node "${args.node_id}" not found` }
    const v = figma.getVariableById(args.variable_id)
    if (!v) return { error: `Variable "${args.variable_id}" not found` }
    figma.bindVariable(args.node_id, args.field, args.variable_id)
    return { node_id: args.node_id, field: args.field, variable_id: args.variable_id }
  }
})

// ─── Collection CRUD tools ────────────────────────────────────

export const getCollection = defineTool({
  name: 'get_collection',
  description: 'Get a variable collection by ID.',
  params: {
    id: { type: 'string', description: 'Collection ID', required: true }
  },
  execute: (figma, { id }) => {
    const c = figma.getVariableCollectionById(id)
    if (!c) return { error: `Collection "${id}" not found` }
    return c
  }
})

export const createCollection = defineTool({
  name: 'create_collection',
  description: 'Create a new variable collection.',
  params: {
    name: { type: 'string', description: 'Collection name', required: true }
  },
  execute: (figma, { name }) => {
    return figma.createVariableCollection(name)
  }
})

export const deleteCollection = defineTool({
  name: 'delete_collection',
  description: 'Delete a variable collection and all its variables.',
  params: {
    id: { type: 'string', description: 'Collection ID', required: true }
  },
  execute: (figma, { id }) => {
    figma.deleteVariableCollection(id)
    return { deleted: id }
  }
})

// ─── Boolean operation tools ──────────────────────────────────

export const booleanUnion = defineTool({
  name: 'boolean_union',
  description: 'Union (combine) multiple nodes.',
  params: {
    ids: { type: 'string[]', description: 'Node IDs to union', required: true }
  },
  execute: (figma, { ids }) => {
    const result = figma.booleanOperation('UNION', ids)
    return nodeSummary(result)
  }
})

export const booleanSubtract = defineTool({
  name: 'boolean_subtract',
  description: 'Subtract the second node from the first.',
  params: {
    ids: { type: 'string[]', description: 'Node IDs (first minus rest)', required: true }
  },
  execute: (figma, { ids }) => {
    const result = figma.booleanOperation('SUBTRACT', ids)
    return nodeSummary(result)
  }
})

export const booleanIntersect = defineTool({
  name: 'boolean_intersect',
  description: 'Intersect multiple nodes.',
  params: {
    ids: { type: 'string[]', description: 'Node IDs to intersect', required: true }
  },
  execute: (figma, { ids }) => {
    const result = figma.booleanOperation('INTERSECT', ids)
    return nodeSummary(result)
  }
})

export const booleanExclude = defineTool({
  name: 'boolean_exclude',
  description: 'Exclude (XOR) multiple nodes.',
  params: {
    ids: { type: 'string[]', description: 'Node IDs to exclude', required: true }
  },
  execute: (figma, { ids }) => {
    const result = figma.booleanOperation('EXCLUDE', ids)
    return nodeSummary(result)
  }
})

// ─── Vector path tools ────────────────────────────────────────

export const pathGet = defineTool({
  name: 'path_get',
  description: 'Get vector path data of a node.',
  params: {
    id: { type: 'string', description: 'Node ID', required: true }
  },
  execute: (figma, { id }) => {
    const raw = figma.graph.getNode(id)
    if (!raw) return { error: `Node "${id}" not found` }
    if (!raw.vectorNetwork) return { error: `Node "${id}" has no vector data` }
    return { id, vectorNetwork: raw.vectorNetwork }
  }
})

export const pathSet = defineTool({
  name: 'path_set',
  description: 'Set vector path data on a node. Provide a VectorNetwork JSON.',
  params: {
    id: { type: 'string', description: 'Node ID', required: true },
    path: { type: 'string', description: 'VectorNetwork JSON', required: true }
  },
  execute: (figma, args) => {
    const raw = figma.graph.getNode(args.id)
    if (!raw) return { error: `Node "${args.id}" not found` }
    const network = JSON.parse(args.path)
    figma.graph.updateNode(args.id, { vectorNetwork: network } as any)
    return { id: args.id }
  }
})

export const pathScale = defineTool({
  name: 'path_scale',
  description: 'Scale vector path from center.',
  params: {
    id: { type: 'string', description: 'Node ID', required: true },
    factor: { type: 'number', description: 'Scale factor (e.g. 2 for double)', required: true }
  },
  execute: (figma, { id, factor }) => {
    const raw = figma.graph.getNode(id)
    if (!raw) return { error: `Node "${id}" not found` }
    if (!raw.vectorNetwork) return { error: `Node "${id}" has no vector data` }
    const vn = structuredClone(raw.vectorNetwork)
    const cx = raw.width / 2
    const cy = raw.height / 2
    for (const v of vn.vertices) {
      v.x = cx + (v.x - cx) * factor
      v.y = cy + (v.y - cy) * factor
    }
    for (const s of vn.segments) {
      if (s.tangentStart) {
        s.tangentStart.x *= factor
        s.tangentStart.y *= factor
      }
      if (s.tangentEnd) {
        s.tangentEnd.x *= factor
        s.tangentEnd.y *= factor
      }
    }
    figma.graph.updateNode(id, { vectorNetwork: vn } as any)
    return { id, factor }
  }
})

export const pathFlip = defineTool({
  name: 'path_flip',
  description: 'Flip vector path horizontally or vertically.',
  params: {
    id: { type: 'string', description: 'Node ID', required: true },
    axis: {
      type: 'string',
      description: 'Flip axis',
      required: true,
      enum: ['horizontal', 'vertical']
    }
  },
  execute: (figma, { id, axis }) => {
    const raw = figma.graph.getNode(id)
    if (!raw) return { error: `Node "${id}" not found` }
    if (!raw.vectorNetwork) return { error: `Node "${id}" has no vector data` }
    const vn = structuredClone(raw.vectorNetwork)
    const w = raw.width
    const h = raw.height
    for (const v of vn.vertices) {
      if (axis === 'horizontal') v.x = w - v.x
      else v.y = h - v.y
    }
    for (const s of vn.segments) {
      if (s.tangentStart) {
        if (axis === 'horizontal') s.tangentStart.x = -s.tangentStart.x
        else s.tangentStart.y = -s.tangentStart.y
      }
      if (s.tangentEnd) {
        if (axis === 'horizontal') s.tangentEnd.x = -s.tangentEnd.x
        else s.tangentEnd.y = -s.tangentEnd.y
      }
    }
    figma.graph.updateNode(id, { vectorNetwork: vn } as any)
    return { id, axis }
  }
})

export const pathMove = defineTool({
  name: 'path_move',
  description: 'Move all path points by an offset.',
  params: {
    id: { type: 'string', description: 'Node ID', required: true },
    dx: { type: 'number', description: 'X offset', required: true },
    dy: { type: 'number', description: 'Y offset', required: true }
  },
  execute: (figma, { id, dx, dy }) => {
    const raw = figma.graph.getNode(id)
    if (!raw) return { error: `Node "${id}" not found` }
    if (!raw.vectorNetwork) return { error: `Node "${id}" has no vector data` }
    const vn = structuredClone(raw.vectorNetwork)
    for (const v of vn.vertices) {
      v.x += dx
      v.y += dy
    }
    figma.graph.updateNode(id, { vectorNetwork: vn } as any)
    return { id, dx, dy }
  }
})

// ─── Create tools (specific shapes) ──────────────────────────

export const createPage = defineTool({
  name: 'create_page',
  description: 'Create a new page.',
  params: {
    name: { type: 'string', description: 'Page name', required: true }
  },
  execute: (figma, { name }) => {
    const page = figma.createPage()
    page.name = name
    return { id: page.id, name }
  }
})

export const createVector = defineTool({
  name: 'create_vector',
  description: 'Create a vector node with optional path data.',
  params: {
    x: { type: 'number', description: 'X position', required: true },
    y: { type: 'number', description: 'Y position', required: true },
    name: { type: 'string', description: 'Node name' },
    path: { type: 'string', description: 'VectorNetwork JSON' },
    fill: { type: 'color', description: 'Fill color (hex)' },
    stroke: { type: 'color', description: 'Stroke color (hex)' },
    stroke_weight: { type: 'number', description: 'Stroke weight' },
    parent_id: { type: 'string', description: 'Parent node ID' }
  },
  execute: (figma, args) => {
    const node = figma.createVector()
    node.x = args.x
    node.y = args.y
    if (args.name) node.name = args.name
    if (args.path) {
      figma.graph.updateNode(node.id, { vectorNetwork: JSON.parse(args.path) } as any)
    }
    if (args.fill) {
      node.fills = [{ type: 'SOLID', color: parseColor(args.fill), opacity: 1, visible: true }]
    }
    if (args.stroke) {
      node.strokes = [
        {
          color: parseColor(args.stroke),
          weight: args.stroke_weight ?? 1,
          opacity: 1,
          visible: true,
          align: 'CENTER'
        }
      ]
    }
    if (args.parent_id) {
      const parent = figma.getNodeById(args.parent_id)
      if (parent) parent.appendChild(node)
    }
    return nodeSummary(node)
  }
})

export const createSlice = defineTool({
  name: 'create_slice',
  description: 'Create a slice (export region) on the canvas.',
  params: {
    x: { type: 'number', description: 'X position', required: true },
    y: { type: 'number', description: 'Y position', required: true },
    width: { type: 'number', description: 'Width', required: true, min: 1 },
    height: { type: 'number', description: 'Height', required: true, min: 1 },
    name: { type: 'string', description: 'Slice name' },
    parent_id: { type: 'string', description: 'Parent node ID' }
  },
  execute: (figma, args) => {
    const node = figma.createFrame()
    node.x = args.x
    node.y = args.y
    node.resize(args.width, args.height)
    node.name = args.name ?? 'Slice'
    node.fills = []
    if (args.parent_id) {
      const parent = figma.getNodeById(args.parent_id)
      if (parent) parent.appendChild(node)
    }
    return nodeSummary(node)
  }
})

// ─── Group tools ──────────────────────────────────────────────

export const flattenNodes = defineTool({
  name: 'flatten_nodes',
  description: 'Flatten nodes into a single vector.',
  params: {
    ids: { type: 'string[]', description: 'Node IDs to flatten', required: true }
  },
  execute: (figma, { ids }) => {
    const result = figma.flattenNode(ids)
    return nodeSummary(result)
  }
})

// ─── Viewport tools ───────────────────────────────────────────

export const viewportGet = defineTool({
  name: 'viewport_get',
  description: 'Get current viewport position and zoom level.',
  params: {},
  execute: (figma) => {
    return figma.viewport
  }
})

export const viewportSet = defineTool({
  name: 'viewport_set',
  description: 'Set viewport position and zoom.',
  params: {
    x: { type: 'number', description: 'Center X', required: true },
    y: { type: 'number', description: 'Center Y', required: true },
    zoom: { type: 'number', description: 'Zoom level', required: true, min: 0.01 }
  },
  execute: (figma, { x, y, zoom }) => {
    figma.viewport = { center: { x, y }, zoom }
    return { x, y, zoom }
  }
})

export const viewportZoomToFit = defineTool({
  name: 'viewport_zoom_to_fit',
  description: 'Zoom viewport to fit specified nodes.',
  params: {
    ids: { type: 'string[]', description: 'Node IDs to fit in view', required: true }
  },
  execute: (figma, { ids }) => {
    let minX = Infinity
    let minY = Infinity
    let maxX = -Infinity
    let maxY = -Infinity
    for (const id of ids) {
      const node = figma.getNodeById(id)
      if (!node) continue
      const bounds = node.absoluteBoundingBox
      minX = Math.min(minX, bounds.x)
      minY = Math.min(minY, bounds.y)
      maxX = Math.max(maxX, bounds.x + bounds.width)
      maxY = Math.max(maxY, bounds.y + bounds.height)
    }
    if (minX === Infinity) return { error: 'No valid nodes found' }
    const cx = (minX + maxX) / 2
    const cy = (minY + maxY) / 2
    figma.viewport = { center: { x: cx, y: cy }, zoom: 1 }
    return {
      center: { x: cx, y: cy },
      bounds: { x: minX, y: minY, width: maxX - minX, height: maxY - minY }
    }
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

// ─── Font tools ───────────────────────────────────────────────

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
          fonts.get(key)!.add(raw.fontWeight)
        }
      }
      return false
    })
    let result = [...fonts.entries()].map(([family, weights]) => ({
      family,
      weights: [...weights].sort()
    }))
    if (args.family) {
      const q = args.family.toLowerCase()
      result = result.filter((f) => f.family.toLowerCase().includes(q))
    }
    return { count: result.length, fonts: result }
  }
})

// ─── Text properties ──────────────────────────────────────────

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
    text_decoration: {
      type: 'string',
      description: 'Text decoration',
      enum: ['NONE', 'UNDERLINE', 'STRIKETHROUGH']
    }
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
    if (args.text_decoration !== undefined) {
      node.textDecoration = args.text_decoration
      updated.push('textDecoration')
    }
    return { id: args.id, updated }
  }
})

// ─── Layout child ─────────────────────────────────────────────

export const setLayoutChild = defineTool({
  name: 'set_layout_child',
  description:
    'Configure auto-layout child: sizing (FIXED/HUG/FILL), grow, alignment, absolute positioning.',
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
    grow: { type: 'number', description: 'Flex grow factor (0 = fixed, 1 = grow)', min: 0 },
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

// ─── Export tools ─────────────────────────────────────────────

export const exportSvg = defineTool({
  name: 'export_svg',
  description: 'Export nodes as SVG markup. Returns the SVG string.',
  params: {
    ids: {
      type: 'string[]',
      description: 'Node IDs to export. Omit to export all top-level nodes on the current page.'
    }
  },
  execute: async (figma, args) => {
    const { renderNodesToSVG } = await import('../svg-export.js')
    const pageId = figma.currentPageId
    const ids =
      args.ids && args.ids.length > 0
        ? args.ids
        : figma.currentPage.children.map((n) => n.id)
    const svg = renderNodesToSVG(figma.graph, pageId, ids)
    if (!svg) return { error: 'No visible nodes to export' }
    return { svg }
  }
})

// ─── Registry ─────────────────────────────────────────────────

export const ALL_TOOLS: ToolDef[] = [
  getSelection,
  getPageTree,
  getNode,
  findNodes,
  createShape,
  render,
  setFill,
  setStroke,
  setEffects,
  updateNode,
  setLayout,
  setConstraints,
  deleteNode,
  cloneNode,
  renameNode,
  reparentNode,
  selectNodes,
  groupNodes,
  ungroupNode,
  createComponent,
  createInstance,
  listPages,
  switchPage,
  listVariables,
  listCollections,
  evalCode,
  // Granular set tools
  setRotation,
  setOpacity,
  setRadius,
  setMinMax,
  setText,
  setFont,
  setFontRange,
  setTextResize,
  setVisible,
  setBlend,
  setLocked,
  setStrokeAlign,
  // Node operations
  nodeBounds,
  nodeMove,
  nodeResize,
  nodeAncestors,
  nodeChildren,
  nodeTree,
  nodeBindings,
  nodeReplaceWith,
  // Variable CRUD
  getVariable,
  findVariables,
  createVariable,
  setVariable,
  deleteVariable,
  bindVariable,
  // Collection CRUD
  getCollection,
  createCollection,
  deleteCollection,
  // Boolean operations
  booleanUnion,
  booleanSubtract,
  booleanIntersect,
  booleanExclude,
  // Vector path tools
  pathGet,
  pathSet,
  pathScale,
  pathFlip,
  pathMove,
  // Create tools
  createPage,
  createVector,
  createSlice,
  // Group tools
  flattenNodes,
  // Viewport tools
  viewportGet,
  viewportSet,
  viewportZoomToFit,
  pageBounds,
  // Font tools
  listFonts,
  // Text properties
  setTextProperties,
  // Layout child
  setLayoutChild,
  // Export
  exportSvg
]
