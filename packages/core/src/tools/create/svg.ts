import { createSVGNodes } from '#core/io/formats/svg'
import { defineTool } from '#core/tools/schema'

export const importSVG = defineTool({
  name: 'import_svg',
  mutates: true,
  description:
    'Import raw SVG markup onto the canvas as editable vector nodes. Supports common SVG shapes, inherited presentation attributes, transforms, gradients, and internal <use> references.',
  params: {
    svg: {
      type: 'string',
      description: 'SVG markup string (e.g. \'<svg viewBox="0 0 24 24"><path d="M..."/></svg>\')',
      required: true
    },
    name: { type: 'string', description: 'Name for the created frame (default: "SVG")' },
    color: {
      type: 'color',
      description: 'Default color for currentColor fills/strokes (default: #000000)'
    },
    parent_id: { type: 'string', description: 'Parent node ID' },
    x: { type: 'number', description: 'X position' },
    y: { type: 'number', description: 'Y position' }
  },
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
