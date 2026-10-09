import * as v from 'valibot'

import { createSVGNodes } from '#core/io/formats/svg'
import { toolNumber } from '#core/tools/input'
import { defineTool } from '#core/tools/schema'

export const importSVG = defineTool({
  name: 'import_svg',

  description:
    'Import raw SVG markup onto the canvas as editable vector nodes. Supports common SVG shapes, inherited presentation attributes, transforms, gradients, and internal <use> references.',
  execution: { kind: 'async', mutation: 'document' },
  input: v.strictObject({
    svg: v.pipe(
      v.string(),
      v.description('SVG markup string (e.g. \'<svg viewBox="0 0 24 24"><path d="M..."/></svg>\')')
    ),
    name: v.optional(
      v.pipe(v.string(), v.description('Name for the created frame (default: "SVG")'))
    ),
    color: v.optional(
      v.pipe(
        v.string(),
        v.description('Default color for currentColor fills/strokes (default: #000000)')
      )
    ),
    parent_id: v.optional(v.pipe(v.string(), v.description('Parent node ID'))),
    x: v.optional(toolNumber(v.pipe(v.number(), v.description('X position')))),
    y: v.optional(toolNumber(v.pipe(v.number(), v.description('Y position'))))
  }),
  execute: async (figma, args) => {
    if (!args.svg || typeof args.svg !== 'string') return { error: 'svg parameter is required' }

    const frame = createSVGNodes(figma.graph, args.parent_id ?? figma.currentPage.id, args.svg, {
      name: args.name,
      defaultColor: args.color,
      x: args.x,
      y: args.y
    })
    if (!frame) return { error: 'No supported SVG elements found in the markup' }
    return { id: frame.id, name: frame.name, type: frame.type }
  }
})
