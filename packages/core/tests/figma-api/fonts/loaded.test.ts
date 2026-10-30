import { beforeAll, describe, expect, test } from 'bun:test'

import { asTextNode, registerTestFont, solidFill } from '#core-tests/helpers/figma-api'

import { FigmaAPI } from '@open-pencil/core/figma-api'
import { SceneGraph } from '@open-pencil/scene-graph'

// Measured in live Figma (2026-10-27) on text whose font no script had loaded.
const UNLOADED = 'Unloaded Sans'
const unloadedWrite = (method: string) =>
  `in ${method}: Cannot write to node with unloaded font "${UNLOADED} Regular". Please call figma.loadFontAsync({ family: "${UNLOADED}", style: "Regular" }) and await the returned promise first.`

beforeAll(async () => {
  await registerTestFont()
  await registerTestFont('Weight Test')
  await new FigmaAPI(new SceneGraph()).loadFontAsync({ family: 'Inter', style: 'Bold' })
})

/** Text a file set in a font this run has not loaded, as a document can name one. */
function unloadedText() {
  const graph = new SceneGraph()
  const api = new FigmaAPI(graph)
  const node = asTextNode(api.createText())
  graph.updateNode(node.id, { text: 'Hello world', fontFamily: UNLOADED })
  return { graph, node, raw: () => graph.getNode(node.id) }
}

describe('text in a font that is not loaded', () => {
  test('refuses every edit that lays it out again, and changes nothing', () => {
    const { node, raw } = unloadedText()
    const before = structuredClone(raw())
    const edits: [string, () => void][] = [
      ['set_characters', () => (node.characters = 'Changed')],
      ['set_fontSize', () => (node.fontSize = 20)],
      ['set_letterSpacing', () => (node.letterSpacing = { unit: 'PIXELS', value: 1 })],
      ['set_lineHeight', () => (node.lineHeight = { unit: 'PIXELS', value: 30 })],
      ['set_textCase', () => (node.textCase = 'UPPER')],
      ['set_textDecoration', () => (node.textDecoration = 'UNDERLINE')],
      ['set_paragraphSpacing', () => (node.paragraphSpacing = 4)],
      ['set_textAutoResize', () => (node.textAutoResize = 'HEIGHT')],
      ['set_textAlignHorizontal', () => (node.textAlignHorizontal = 'CENTER')],
      ['set_textTruncation', () => (node.textTruncation = 'ENDING')],
      ['insertCharacters', () => node.insertCharacters(0, 'A')],
      ['deleteCharacters', () => node.deleteCharacters(0, 1)],
      ['setRangeFontSize', () => node.setRangeFontSize(0, 2, 30)],
      ['setRangeTextCase', () => node.setRangeTextCase(0, 2, 'UPPER')],
      ['setRangeListOptions', () => node.setRangeListOptions(0, 2, { type: 'ORDERED' })],
      ['setRangeIndentation', () => node.setRangeIndentation(0, 2, 1)],
      ['setRangeParagraphSpacing', () => node.setRangeParagraphSpacing(0, 2, 4)]
    ]
    for (const [method, edit] of edits) expect(edit).toThrow(unloadedWrite(method))
    expect(raw()).toEqual(before)
  })

  test('reports a wrong argument before the font', () => {
    const { node } = unloadedText()
    expect(() => node.setRangeFontSize(0, 99, 20)).toThrow('Range outside of available characters')
    expect(() => node.setRangeFontSize(2, 2, 20)).toThrow('Empty range selected')
    expect(() => node.insertCharacters(99, 'A')).toThrow(
      'in insertCharacters: Cannot insert characters at index greater than the length of the text'
    )
    expect(() => node.setRangeIndentation(0, 2, 9)).toThrow(
      'in setRangeIndentation: Property "indentation" failed validation'
    )
  })

  test('refuses underline details but takes the underline colour, a paint', () => {
    const { graph, node, raw } = unloadedText()
    graph.updateNode(node.id, { textDecoration: 'UNDERLINE' })
    const details: [string, () => void][] = [
      ['setRangeTextDecorationStyle', () => node.setRangeTextDecorationStyle(0, 2, 'WAVY')],
      [
        'setRangeTextDecorationOffset',
        () => node.setRangeTextDecorationOffset(0, 2, { unit: 'PIXELS', value: 2 })
      ],
      [
        'setRangeTextDecorationThickness',
        () => node.setRangeTextDecorationThickness(0, 2, { unit: 'PIXELS', value: 2 })
      ],
      ['setRangeTextDecorationSkipInk', () => node.setRangeTextDecorationSkipInk(0, 2, false)]
    ]
    for (const [method, edit] of details) expect(edit).toThrow(unloadedWrite(method))
    node.setRangeTextDecorationColor(0, 2, { value: 'AUTO' })
    expect(raw()?.textDecoration).toBe('UNDERLINE')
  })

  test('names fonts in its messages by the name the text has for its face', () => {
    const { graph, node } = unloadedText()
    graph.updateNode(node.id, { fontWeight: 600 })
    expect(() => (node.fontSize = 20)).toThrow(`unloaded font "${UNLOADED} SemiBold"`)
    // A file names the face as its font does, which Figma's message repeats.
    graph.updateNode(node.id, { fontStyle: 'Semi Bold' })
    expect(() => (node.fontSize = 20)).toThrow(`unloaded font "${UNLOADED} Semi Bold"`)
  })

  test('takes paints, links, a size, and a name, which need no font', () => {
    const { node, raw } = unloadedText()
    node.fills = [solidFill({ r: 1, g: 0, b: 0, a: 1 })]
    node.setRangeFills(0, 2, [solidFill({ r: 0, g: 1, b: 0, a: 1 })])
    node.setRangeHyperlink(0, 2, { type: 'URL', value: 'https://openpencil.dev' })
    node.resize(100, 40)
    node.name = 'Renamed'
    expect(raw()).toMatchObject({ name: 'Renamed', width: 100, height: 40 })
  })

  test('takes a loaded font for all of it, so a missing font can be replaced', () => {
    const { node, raw } = unloadedText()
    node.fontName = { family: 'Inter', style: 'Bold' }
    expect(raw()).toMatchObject({ fontFamily: 'Inter', fontWeight: 700 })
    node.characters = 'Now editable'
    expect(node.characters).toBe('Now editable')
  })

  test('refuses a new font that is not loaded before checking the text’s own', () => {
    const { node } = unloadedText()
    const unloadedUse = (method: string) =>
      `in ${method}: Cannot use unloaded font "Other Sans Regular". Please call figma.loadFontAsync({ family: "Other Sans", style: "Regular" }) and await the returned promise first.`
    const other = { family: 'Other Sans', style: 'Regular' }
    expect(() => (node.fontName = other)).toThrow(unloadedUse('set_fontName'))
    expect(() => node.setRangeFontName(0, 2, other)).toThrow(unloadedUse('setRangeFontName'))
    expect(() => node.setRangeFontName(0, 2, { family: 'Inter', style: 'Bold' })).toThrow(
      unloadedWrite('setRangeFontName')
    )
  })
  test('takes a weight once its face is loaded, as a new font', async () => {
    const graph = new SceneGraph()
    const api = new FigmaAPI(graph)
    const node = asTextNode(api.createText())
    graph.updateNode(node.id, { fontFamily: 'Weight Test' })
    expect(() => (node.fontWeight = 900)).toThrow(
      'in set_fontWeight: Cannot use unloaded font "Weight Test Black".'
    )
    await api.loadFontAsync({ family: 'Weight Test', style: 'Black' })
    node.fontWeight = 900
    expect(node.fontName).toMatchObject({ family: 'Weight Test', style: 'Black' })
  })
})
