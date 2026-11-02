import { beforeAll, describe, expect, test } from 'bun:test'
import { toUint8Array } from 'js-base64'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

import { expectDefined } from '#core-tests/helpers/assert'
import { FIXTURES } from '#core-tests/helpers/paths'

import {
  cutFontInstances,
  embeddedFontAlias,
  planFontEmbedding,
  registerEmbeddedFonts,
  type PDFFontTarget
} from '#core/io/formats/pdf/fonts'
import type { SVGFontRequest } from '#core/io/formats/svg'
import { isVariableFont } from '#core/text/font/variation'
import { fontManager } from '#core/text/font/manager'

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

/**
 * Text in `family` and `style` at 16 px, its optical size following its size. Variable faces are
 * named apart from the fonts other tests load, whose named instances would set their axes.
 */
function font(family: string, style: string, request: Partial<SVGFontRequest> = {}): SVGFontRequest {
  return {
    family,
    style,
    weight: style.includes('Bold') ? 700 : 400,
    italic: style.includes('Italic'),
    fontSize: 16,
    variations: [],
    opticalSizeFromFontSize: true,
    ...request
  }
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
    const regular = expectDefined(alias(font('Inter', 'Regular')), 'Regular alias')
    const bold = expectDefined(alias(font('Inter', 'Bold')), 'Bold alias')
    expect(regular).toMatch(/^[A-Za-z0-9]+$/)
    expect(bold).not.toBe(regular)
    expect(fonts.map((font) => font.family)).toEqual([regular, bold])
    expect(alias(font('Inter', 'Italic'))).toBeNull()
  })

  test('falls back to a standard font when a face cannot be embedded, and says why', () => {
    const { doc, fonts } = pdfDoc()
    const embedding = planFontEmbedding([
      { family: 'Missing', style: 'Italic', data: null },
      { family: 'Unsupported', style: 'Regular', data: null, missing: 'unsupported font format' },
      { family: 'Cff', style: 'Italic', data: cff }
    ])

    expect(registerEmbeddedFonts(doc, embedding)).toBe(true)
    expect(fonts).toEqual([])
    expect(embedding.report).toEqual({
      embedded: [],
      fallback: [
        { face: 'Missing Italic', reason: 'font file not available' },
        { face: 'Unsupported Regular', reason: 'unsupported font format' },
        { face: 'Cff Italic', reason: 'not a TrueType font file' }
      ]
    })
    
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
    expect(alias(font('Inter', 'Regular'))).not.toBeNull()

    expect(registerEmbeddedFonts(doc, embedding)).toBe(false)
    expect(embedding.report).toEqual({
      embedded: [],
      fallback: [{ face: 'Inter Regular', reason: 'Unsupported font' }]
    })
    expect(alias(font('Inter', 'Regular'))).toBeNull()
  })

  test('embeds a static file of each instance of a variable face the text draws', async () => {
    const { doc, fonts, files } = pdfDoc()
    const embedding = planFontEmbedding([{ family: 'PDF Variable', style: 'Regular', data: interVariable }])
    const alias = embeddedFontAlias(embedding)
    const body = expectDefined(alias(font('PDF Variable', 'Regular')), 'body alias')
    const heading = expectDefined(alias(font('PDF Variable', 'Regular', { fontSize: 24 })), 'heading')
    const heavy = expectDefined(
      alias(font('PDF Variable', 'Regular', { variations: [{ axis: 'wght', value: 650 }] })),
      'heavy alias'
    )

    // The optical size follows the font size within the font's range, 14 to 32.
    const small = expectDefined(alias(font('PDF Variable', 'Regular', { fontSize: 12 })), 'small')
    expect(alias(font('PDF Variable', 'Regular', { fontSize: 13 }))).toBe(small)
    expect(new Set([body, heading, heavy, small]).size).toBe(4)
    expect(await cutFontInstances(embedding)).toBe(true)
    expect(registerEmbeddedFonts(doc, embedding)).toBe(true)
    expect(embedding.report).toEqual({
      embedded: [
        'PDF Variable Regular (opsz 16)',
        'PDF Variable Regular (opsz 24)',
        'PDF Variable Regular (opsz 16, wght 650)',
        'PDF Variable Regular (opsz 14)'
      ],
      fallback: []
    })
    expect(fonts.map((registered) => registered.family)).toEqual([body, heading, heavy, small])
    for (const file of files.values()) {
      expect(isVariableFont(toUint8Array(file).slice().buffer)).toBe(false)
    }
  })

  test('an instance jsPDF rejects falls back, and its text is no longer named by it', async () => {
    const doc: PDFFontTarget = {
      addFileToVFS: () => undefined,
      addFont: () => {
        throw new Error('Unsupported font')
      }
    }
    const embedding = planFontEmbedding([{ family: 'PDF Variable', style: 'Regular', data: interVariable }])
    const alias = embeddedFontAlias(embedding)
    expect(alias(font('PDF Variable', 'Regular'))).not.toBeNull()

    await cutFontInstances(embedding)
    expect(registerEmbeddedFonts(doc, embedding)).toBe(false)
    expect(embedding.report.fallback).toEqual([
      { face: 'PDF Variable Regular (opsz 16)', reason: 'Unsupported font' }
    ])
    expect(alias(font('PDF Variable', 'Regular'))).toBeNull()
  })
})
