import { beforeAll, describe, expect, test } from 'bun:test'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

import { expectDefined } from '#core-tests/helpers/assert'
import { FIXTURES } from '#core-tests/helpers/paths'

import {
  embeddedFontAlias,
  planFontEmbedding,
  registerEmbeddedFonts,
  type PDFFontTarget
} from '#core/io/formats/pdf/fonts'
import { fontManager } from '#core/text/fonts'

/** Records what jsPDF would be asked to register. */
function pdfDoc() {
  const fonts: Array<{ file: string; family: string; style: string }> = []
  const files = new Map<string, string>()
  const doc: PDFFontTarget = {
    addFileToVFS: (file, data) => files.set(file, data),
    addFont: (file, family, style) => fonts.push({ file, family, style })
  }
  return { doc, fonts, files }
}

const fixture = async (name: string) => {
  const data = await readFile(join(FIXTURES, 'fonts', name))
  return data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength)
}

let inter: ArrayBuffer
let interVariable: ArrayBuffer
let cff: ArrayBuffer

beforeAll(async () => {
  // Static, as jsPDF embeds only static TrueType; the canvas labels' face.
  inter = expectDefined(await fontManager.fetchBundledFont('/Inter-SemiBold.ttf'), 'Inter')
  interVariable = await fixture('InterVariable-Latin.ttf')
  cff = await fixture('NotoSansCJK-Test.otf')
})

describe('PDF font embedding', () => {
  test('registers each face under a family name of its own', () => {
    const { doc, fonts, files } = pdfDoc()
    const embedding = planFontEmbedding([
      { family: 'Inter', style: 'Regular', data: inter },
      { family: 'Inter', style: 'Bold', data: inter }
    ])
    const alias = embeddedFontAlias(embedding)

    expect(registerEmbeddedFonts(doc, embedding)).toBe(true)
    expect(embedding.report).toEqual({ embedded: ['Inter Regular', 'Inter Bold'], fallback: [] })
    expect(files.size).toBe(2)
    expect(fonts.every((font) => font.style === 'normal')).toBe(true)
    const regular = expectDefined(alias('Inter', 'Regular'), 'Regular alias')
    const bold = expectDefined(alias('Inter', 'Bold'), 'Bold alias')
    expect(regular).toMatch(/^[A-Za-z0-9]+$/)
    expect(bold).not.toBe(regular)
    expect(fonts.map((font) => font.family)).toEqual([regular, bold])
    expect(alias('Inter', 'Italic')).toBeNull()
  })

  test('falls back to a standard font when a face cannot be embedded, and says why', () => {
    const { doc, fonts } = pdfDoc()
    const embedding = planFontEmbedding([
      { family: 'Missing', style: 'Italic', data: null },
      { family: 'Unsupported', style: 'Regular', data: null, missing: 'unsupported font format' },
      { family: 'Variable', style: 'Italic', data: interVariable },
      { family: 'Cff', style: 'Italic', data: cff }
    ])

    expect(registerEmbeddedFonts(doc, embedding)).toBe(true)
    expect(fonts).toEqual([])
    expect(embedding.report).toEqual({
      embedded: [],
      fallback: [
        { face: 'Missing Italic', reason: 'font file not available' },
        { face: 'Unsupported Regular', reason: 'unsupported font format' },
        { face: 'Variable Italic', reason: 'variable font' },
        { face: 'Cff Italic', reason: 'not a TrueType font file' }
      ]
    })
    expect(embeddedFontAlias(embedding)('Variable', 'Italic')).toBeNull()
  })

  test('a face jsPDF rejects is dropped and reported as a fallback', () => {
    const doc: PDFFontTarget = {
      addFileToVFS: () => undefined,
      addFont: () => {
        throw new Error('Unsupported font')
      }
    }
    const embedding = planFontEmbedding([{ family: 'Inter', style: 'Regular', data: inter }])
    const alias = embeddedFontAlias(embedding)
    expect(alias('Inter', 'Regular')).not.toBeNull()

    expect(registerEmbeddedFonts(doc, embedding)).toBe(false)
    expect(embedding.report).toEqual({
      embedded: [],
      fallback: [{ face: 'Inter Regular', reason: 'Unsupported font' }]
    })
    expect(alias('Inter', 'Regular')).toBeNull()
  })
})
