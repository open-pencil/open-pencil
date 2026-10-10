import * as v from 'valibot'

import type { FigmaNodeProxy } from '#core/figma-api'
import { toolNumber, positionInputs } from '#core/tools/input'
import { defineTool, nodeSummary } from '#core/tools/schema'

export const createShape = defineTool({
  name: 'create_shape',

  description:
    'Create a shape on the canvas. Use FRAME for containers/cards, RECTANGLE for solid blocks, ELLIPSE for circles, TEXT for labels, LINE for rules and dividers, STAR for starbursts and badges, POLYGON for triangles and regular polygons, and SECTION for page sections. Use create_vector with an SVG path for arbitrary shapes.',
  execution: { kind: 'sync', mutation: 'document' },
  input: v.strictObject({
    type: v.pipe(
      v.picklist(['FRAME', 'RECTANGLE', 'ELLIPSE', 'TEXT', 'LINE', 'STAR', 'POLYGON', 'SECTION']),
      v.description('Node type')
    ),
    ...positionInputs,
    width: toolNumber(v.pipe(v.number(), v.minValue(1), v.description('Width in pixels'))),
    height: toolNumber(v.pipe(v.number(), v.minValue(1), v.description('Height in pixels'))),
    name: v.optional(v.pipe(v.string(), v.description('Node name shown in layers panel'))),
    parent_id: v.optional(v.pipe(v.string(), v.description('Parent node ID to nest inside')))
  }),
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
    const node = createMap[args.type]()
    node.x = args.x
    node.y = args.y
    node.resize(args.width, args.height)
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
    width: toolNumber(v.pipe(v.number(), v.minValue(1), v.description('Width'))),
    height: toolNumber(v.pipe(v.number(), v.minValue(1), v.description('Height'))),
    name: v.optional(v.pipe(v.string(), v.description('Slice name'))),
    parent_id: v.optional(v.pipe(v.string(), v.description('Parent node ID')))
  }),
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
