import * as v from 'valibot'

import { graphOf } from '#core/figma-api/graph'
import { prepareSlotInsertion } from '#core/figma-api/slots'
import { createSVGNodesFromImport, prepareSVGImport, svgImportFonts } from '#core/io/formats/svg'
import { toolNumber, defineTool } from '#core/tools/schema'

export const importSVG = defineTool({
  name: 'import_svg',

  description:
    'Import SVG markup as editable layers, as pasting it into Figma does: a frame (a group without width, height, or viewBox) with a group per <g>, a vector per shape, a text per <text>, named by id, and mask groups for clipping. Supports shapes, <tspan> styles, inherited attributes, opacity, transforms, gradients, clip paths, and internal <use>.',
  execution: { kind: 'async', mutation: 'document' },
  input: v.strictObject({
    svg: v.pipe(
      v.string(),
      v.description('SVG markup string (e.g. \'<svg viewBox="0 0 24 24"><path d="M..."/></svg>\')')
    ),
    name: v.optional(
      v.pipe(
        v.string(),
        v.description(
          'Name for the created frame or group (default: the root <svg> id, else "Frame" or "Group")'
        )
      )
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

    const data = prepareSVGImport(args.svg, { defaultColor: args.color })
    // Text is measured and placed as it is created, so its fonts load first.
    await graphOf(figma).waitOutsideEdit(
      Promise.all(
        (data ? svgImportFonts(data) : []).map(({ family, style }) =>
          figma.loadFontAsync({ family, style })
        )
      )
    )
    const parentId = args.parent_id ?? figma.currentPage.id
    if (data) prepareSlotInsertion(graphOf(figma), parentId, 'import_svg')
    const frame =
      data &&
      createSVGNodesFromImport(graphOf(figma), parentId, data, {
        name: args.name,
        x: args.x,
        y: args.y
      })
    if (!frame) return { error: 'No supported SVG elements found in the markup' }
    return { id: frame.id, name: frame.name, type: frame.type }
  }
})
