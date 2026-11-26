import * as v from 'valibot'

import { DEFAULT_FONT_FAMILY } from '@open-pencil/scene-graph/constants'
import { faceLoadKey } from '@open-pencil/scene-graph/font-style'

import type { FigmaNodeProxy } from '#core/figma-api'
import { graphOf } from '#core/figma-api/graph'
import { prepareSlotInsertion } from '#core/figma-api/slots'
import { layoutLength, positionInputs, defineTool, nodeSummary } from '#core/tools/schema'

interface ShapeSize {
  width?: number
  height?: number
}

/** Why a shape of `type` cannot be made with the sizes given, naming the argument to change. */
function shapeSizeError(type: string, { width, height }: ShapeSize): string | null {
  if (type === 'TEXT') {
    return width === undefined && height !== undefined
      ? 'TEXT with a height needs a width. Add width for fixed-size text, or leave out height for text that sizes to its content.'
      : null
  }
  if (width === undefined) return `${type} needs a width. Add width in pixels.`
  if (height === undefined) return `${type} needs a height. Add height in pixels.`
  return null
}

/**
 * Sizes a new shape: text given no width stays auto width, given only a width wraps in it, and given
 * both is fixed. The mode is set outright because `resize` infers it from which sides changed.
 */
function sizeShape(node: FigmaNodeProxy, { width, height }: ShapeSize): void {
  if (width === undefined) return
  node.resize(width, height ?? node.height)
  if (node.type === 'TEXT') node.textAutoResize = height === undefined ? 'HEIGHT' : 'NONE'
}

export const createShape = defineTool({
  name: 'create_shape',

  description:
    'Create a shape on the canvas. Use FRAME for containers/cards, RECTANGLE for solid blocks, ELLIPSE for circles, TEXT for labels (leave out width and height to fit the text, or pass only width to wrap it), LINE for rules and dividers, STAR for starbursts and badges, POLYGON for triangles and regular polygons, and SECTION for page sections. Use create_vector with an SVG path for arbitrary shapes.',
  execution: { kind: 'sync', mutation: 'document' },
  input: v.strictObject({
    type: v.pipe(
      v.picklist(['FRAME', 'RECTANGLE', 'ELLIPSE', 'TEXT', 'LINE', 'STAR', 'POLYGON', 'SECTION']),
      v.description('Node type')
    ),
    ...positionInputs,
    width: v.optional(layoutLength('Width in pixels, required except for TEXT', 1)),
    height: v.optional(layoutLength('Height in pixels, required except for TEXT', 1)),
    name: v.optional(v.pipe(v.string(), v.description('Node name shown in layers panel'))),
    parent_id: v.optional(v.pipe(v.string(), v.description('Parent node ID to nest inside')))
  }),
  // Setting a sizing mode on text needs its font.
  fonts: (_figma, { type, width }) =>
    type === 'TEXT' && width !== undefined
      ? [{ family: DEFAULT_FONT_FAMILY, style: faceLoadKey(400) }]
      : [],
  execute: (figma, args) => {
    const sizeError = shapeSizeError(args.type, args)
    if (sizeError) return { error: sizeError }
    const parentId = args.parent_id
    const parent = parentId ? figma.getNodeById(parentId) : null
    // Refuse before creating, so a refused parent leaves no layer behind on the page.
    if (parent) prepareSlotInsertion(graphOf(figma), parent.id, 'create_shape')
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
    const node = createMap[args.type]()
    node.x = args.x
    node.y = args.y
    sizeShape(node, args)
    if (args.name) node.name = args.name
    if (parent) parent.appendChild(node)
    return nodeSummary(node)
  }
})

export const createPage = defineTool({
  name: 'create_page',

  description: 'Create a new page.',
  execution: { kind: 'sync', mutation: 'document' },
  input: v.strictObject({
    name: v.pipe(v.string(), v.description('Page name'))
  }),
  execute: (figma, { name }) => {
    const page = figma.createPage()
    page.name = name
    return { id: page.id, name }
  }
})

export const createSlice = defineTool({
  name: 'create_slice',

  description: 'Create a slice (export region) on the canvas.',
  execution: { kind: 'sync', mutation: 'document' },
  input: v.strictObject({
    ...positionInputs,
    width: layoutLength('Width', 1),
    height: layoutLength('Height', 1),
    name: v.optional(v.pipe(v.string(), v.description('Slice name'))),
    parent_id: v.optional(v.pipe(v.string(), v.description('Parent node ID')))
  }),
  execute: (figma, args) => {
    const parent = args.parent_id ? figma.getNodeById(args.parent_id) : null
    if (parent) prepareSlotInsertion(graphOf(figma), parent.id, 'create_slice')
    const node = figma.createFrame()
    node.x = args.x
    node.y = args.y
    node.resize(args.width, args.height)
    node.name = args.name ?? 'Slice'
    node.fills = []
    if (parent) parent.appendChild(node)
    return nodeSummary(node)
  }
})
