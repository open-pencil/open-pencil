import { beforeAll, describe, expect, test } from 'bun:test'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

import { expectDefined } from '#core-tests/helpers/assert'
import { FIXTURES } from '#core-tests/helpers/paths'

import {
  embedFonts,
  type PDFFace,
  type PDFFontTarget,
  type SVGTextElementLike
} from '#core/io/formats/pdf/fonts'
import { fontManager } from '#core/text/fonts'

/** An SVG element with attributes and a parent, enough for the font pass. */
class Element implements SVGTextElementLike {
  readonly attributes: Map<string, string>
  constructor(
    attributes: Record<string, string>,
    readonly parentElement: Element | null = null
  ) {
    this.attributes = new Map(Object.entries(attributes))
  }
  getAttribute(name: string) {
    return this.attributes.get(name) ?? null
  }
  setAttribute(name: string, value: string) {
    this.attributes.set(name, value)
  }
}

const svgRoot = (...elements: Element[]) => ({ querySelectorAll: () => elements })

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
  inter = expectDefined(await fontManager.fetchBundledFont('/Inter-Regular.ttf'), 'Inter')
  interVariable = await fixture('InterVariable-Latin.ttf')
  cff = await fixture('NotoSansCJK-Test.otf')
})

describe('embedFonts', () => {
  test('registers each face once and points its text at it', async () => {
    const { doc, fonts, files } = pdfDoc()
    const heading = new Element({ 'font-family': 'Inter', 'font-weight': '700' })
    const body = new Element({ 'font-family': "'Inter', sans-serif" })
    const bold = new Element({ 'font-weight': 'bold' }, body)
    const loaded: PDFFace[] = []

    const report = await embedFonts(doc, [svgRoot(heading, body, bold)], async (face) => {
      loaded.push(face)
      return inter
    })

    expect(loaded).toEqual([
      { family: 'Inter', weight: 700, italic: false },
      { family: 'Inter', weight: 400, italic: false }
    ])
    expect(report).toEqual({ embedded: ['Inter 700', 'Inter 400'], fallback: [] })
    expect(fonts).toHaveLength(2)
    expect(files.size).toBe(2)
    expect(fonts.every((font) => font.style === 'normal')).toBe(true)
    // The child reads its face before its parent is renamed, and names its own font.
    expect(bold.getAttribute('font-family')).toBe(heading.getAttribute('font-family'))
    expect(body.getAttribute('font-family')).not.toBe(heading.getAttribute('font-family'))
    for (const element of [heading, body, bold]) {
      expect(element.getAttribute('font-family')).toMatch(/^[A-Za-z0-9]+$/)
      expect(element.getAttribute('font-weight')).toBe('normal')
      expect(element.getAttribute('font-style')).toBe('normal')
    }
  })

  test('falls back to a standard font when a face cannot be embedded, and says why', async () => {
    const { doc, fonts } = pdfDoc()
    const files: Record<string, ArrayBuffer | null> = {
      Missing: null,
      Variable: interVariable,
      Cff: cff
    }
    const elements = Object.keys(files).map(
      (family) => new Element({ 'font-family': family, 'font-style': 'italic' })
    )
    const failing = new Element({ 'font-family': 'Broken', 'font-weight': '300' })

    const report = await embedFonts(doc, [svgRoot(...elements, failing)], async (face) => {
      if (face.family === 'Broken') throw new Error('network error')
      return files[face.family] ?? null
    })

    expect(fonts).toEqual([])
    expect(report.embedded).toEqual([])
    expect(report.fallback).toEqual([
      { face: 'Missing 400 italic', reason: 'font file not available' },
      { face: 'Variable 400 italic', reason: 'variable font' },
      { face: 'Cff 400 italic', reason: 'not a TrueType font file' },
      { face: 'Broken 300', reason: 'network error' }
    ])
    expect(elements[1].getAttribute('font-family')).toBe('Variable')
    expect(elements[1].getAttribute('font-style')).toBe('italic')
    expect(failing.getAttribute('font-weight')).toBe('300')
  })

  test('a face jsPDF rejects is reported as a fallback', async () => {
    const element = new Element({ 'font-family': 'Inter' })
    const doc: PDFFontTarget = {
      addFileToVFS: () => undefined,
      addFont: () => {
        throw new Error('Unsupported font')
      }
    }
    const report = await embedFonts(doc, [svgRoot(element)], async () => inter)
    expect(report).toEqual({
      embedded: [],
      fallback: [{ face: 'Inter 400', reason: 'Unsupported font' }]
    })
    expect(element.getAttribute('font-family')).toBe('Inter')
  })
})
