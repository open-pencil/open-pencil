import { uniq } from 'es-toolkit/array'
import * as v from 'valibot'

import { OpenPencilAPI } from '#core/openpencil-api'
import { defineTool } from '#core/tools/schema'

export const getFontStatus = defineTool({
  name: 'get_font_status',
  description:
    'Report whether fonts used on the current page are faithfully available. Returns requested ' +
    'faces, their loaded source, active substitutions, why an installed face could not be ' +
    'loaded, and affected nodes.',
  execution: { kind: 'sync', mutation: 'none' },
  exposure: { webmcp: false },
  input: v.strictObject({
    family: v.optional(v.pipe(v.string(), v.description('Filter by family name (substring)')))
  }),
  execute: (figma, { family }) => {
    const status = new OpenPencilAPI(figma).getFontStatus()
    if (!family) return status
    const query = family.toLowerCase()
    const matches = (face: { family: string }) => face.family.toLowerCase().includes(query)
    const issues = status.issues.filter(matches)
    return { faithful: issues.length === 0, faces: status.faces.filter(matches), issues }
  }
})

export const listAvailableFonts = defineTool({
  name: 'list_available_fonts',
  description:
    'List font families the host can render: installed, bundled, and online families. ' +
    'Use this to discover what fonts are available to set on a text node — distinct from ' +
    'get_font_status, which reports the faces used on the page.',
  execution: { kind: 'async', mutation: 'none' },
  exposure: { webmcp: false },
  input: v.strictObject({
    family: v.optional(
      v.pipe(v.string(), v.description('Filter by family name (substring, case-insensitive)'))
    )
  }),
  execute: async (figma, args) => {
    const fonts = await figma.listAvailableFontsAsync()
    let families = uniq(fonts.map((font) => font.fontName.family))
    if (args.family) {
      const q = args.family.toLowerCase()
      families = families.filter((family) => family.toLowerCase().includes(q))
    }
    families.sort((a, b) => a.localeCompare(b))
    return { count: families.length, fonts: families }
  }
})
