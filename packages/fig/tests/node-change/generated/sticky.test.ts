import { describe, expect, test } from 'bun:test'

import { expectDefined } from '#fig-tests/helpers/assert'
import { normalizeFigFragment } from '#fig/document/fragment'
import { derivedFrameEntriesOf, generationOverridesOf } from '#fig/node-change/generated/records'
import { sceneNodeToKiwi } from '#fig/node-change/index'

import { materializeDocument } from '@open-pencil/fig'
import type { NodeChange } from '@open-pencil/kiwi/fig/codec'
import type { SceneGraph, SceneNode } from '@open-pencil/scene-graph'
import { createSticky, stickySublayers, STICKY_COLORS } from '@open-pencil/scene-graph/generated'
import { percentLength, pixelLength } from '@open-pencil/scene-graph/text'

const guid = (localID: number) => ({ sessionID: 0, localID })
const slot = (localID: number) => ({ guids: [{ sessionID: 40_000_000, localID }] })
const at = (x: number, y: number) => ({ m00: 1, m01: 0, m02: x, m10: 0, m11: 1, m12: y })
const pink = { r: 1, g: 0.6, b: 0.8, a: 1 }
const black = { r: 0, g: 0, b: 0, a: 1 }

/** A note FigJam rescaled by 1.5 with its author hidden, as its clipboard writes it. */
const scaledNote: NodeChange = {
  guid: guid(2),
  type: 'STICKY',
  name: 'Note',
  size: { x: 360, y: 360 },
  transform: at(100, 50),
  autoRename: false,
  frameMaskDisabled: true,
  nodeGenerationData: {
    overrides: [
      {
        guidPath: slot(0),
        fillPaints: [{ type: 'SOLID', color: pink, opacity: 1, visible: true }]
      },
      {
        guidPath: slot(1),
        fontSize: 24,
        fontName: { family: 'Inter', style: 'Medium', postscript: '' },
        lineHeight: { value: 1.5, units: 'RAW' },
        letterSpacing: { value: -1.1, units: 'PERCENT' },
        textData: { characters: 'Scaled' },
        fillPaints: [{ type: 'SOLID', color: black, opacity: 0.8, visible: true }]
      },
      {
        guidPath: slot(2),
        visible: false,
        fontSize: 18,
        fontName: { family: 'Inter', style: 'Medium', postscript: '' },
        lineHeight: { value: 24, units: 'PIXELS' },
        textData: { characters: 'Ada Lovelace' }
      }
    ]
  },
  derivedImmutableFrameData: {
    overrides: [
      { guidPath: slot(0), size: { x: 360, y: 360 }, transform: at(0, 0) },
      { guidPath: slot(1), size: { x: 300, y: 36 }, transform: at(30, 30) },
      { guidPath: slot(2), size: { x: 300, y: 24 }, transform: at(30, 306) }
    ],
    version: 1
  }
}

function importNote(record: NodeChange): { graph: SceneGraph; sticky: SceneNode } {
  const graph = materializeDocument(normalizeFigFragment([record])).graph
  const sticky = graph.getChildren(graph.getPages()[0].id)[0]
  return { graph, sticky }
}

describe('sticky notes', () => {
  test('import builds the note from its generated sublayers', () => {
    const { graph, sticky } = importNote(scaledNote)
    expect(sticky.type).toBe('STICKY')
    expect(sticky.fills.map((fill) => fill.color)).toEqual([pink])
    expect(sticky).toMatchObject({
      x: 100,
      y: 50,
      width: 360,
      height: 360,
      layoutMode: 'VERTICAL',
      primaryAxisAlign: 'SPACE_BETWEEN',
      paddingTop: 30,
      itemSpacing: 24,
      minHeight: 360
    })
    const { body, author } = expectDefined(stickySublayers(graph, sticky))
    expect(body).toMatchObject({
      text: 'Scaled',
      fontFamily: 'Inter',
      fontWeight: 500,
      fontSize: 24,
      lineHeight: percentLength(150),
      x: 30,
      y: 30,
      width: 300,
      textAutoResize: 'HEIGHT',
      layoutAlignSelf: 'STRETCH'
    })
    expect(author).toMatchObject({ text: 'Ada Lovelace', fontSize: 18, visible: false })
  })

  test('export writes the sublayers on the note record, as Figma stores them', () => {
    const { graph, sticky } = importNote(scaledNote)
    const records = sceneNodeToKiwi(sticky, guid(1), 0, { value: 10 }, graph, [])
    expect(records).toHaveLength(1)
    const [record] = records
    expect(record.type).toBe('STICKY')
    expect(record.fillPaints).toBeUndefined()
    expect(record.stackMode).toBeUndefined()
    expect(record.textData).toBeUndefined()

    const overrides = generationOverridesOf(record)
    expect(overrides.get(0)?.fillPaints?.[0]?.color).toEqual(pink)
    expect(overrides.get(1)?.textData?.characters).toBe('Scaled')
    expect(overrides.get(1)?.fontSize).toBe(24)
    expect(overrides.get(2)?.textData?.characters).toBe('Ada Lovelace')
    expect(overrides.get(2)?.visible).toBe(false)

    // Without shaped glyphs, Figma would draw the saved layout's empty text; it lays the note
    // out afresh only when the derived data is missing.
    expect(record.derivedImmutableFrameData).toBeUndefined()
    expect(derivedFrameEntriesOf(record).size).toBe(0)
  })

  test('a new note round-trips through its record', () => {
    const { graph } = importNote({ ...scaledNote, nodeGenerationData: undefined })
    const page = graph.getPages()[0]
    const note = createSticky(graph, page.id, {
      text: 'Hello',
      author: 'Grace',
      color: STICKY_COLORS.yellow
    })
    const [record] = sceneNodeToKiwi(note, guid(1), 0, { value: 10 }, graph, [])
    const { graph: reread, sticky } = importNote({ ...record, guid: guid(5) })
    expect(sticky.fills[0]?.color).toEqual(STICKY_COLORS.yellow)
    expect(sticky.effects).toHaveLength(3)
    const { body, author } = expectDefined(stickySublayers(reread, sticky))
    expect(body).toMatchObject({ text: 'Hello', fontSize: 16, lineHeight: percentLength(150) })
    expect(author).toMatchObject({
      text: 'Grace',
      fontSize: 12,
      lineHeight: pixelLength(16),
      visible: true
    })
    expect(sticky).toMatchObject({ paddingLeft: 20, itemSpacing: 16, minHeight: 240 })
  })

  test('a note that lost its sublayers is saved as a frame with its children', () => {
    const { graph, sticky } = importNote(scaledNote)
    const author = expectDefined(stickySublayers(graph, sticky)).author
    graph.deleteNode(author.id)
    const records = sceneNodeToKiwi(sticky, guid(1), 0, { value: 10 }, graph, [])
    expect(records.map((record) => record.type)).toEqual(['FRAME', 'TEXT'])
    expect(records[1].textData?.characters).toBe('Scaled')
    expect(records[0].nodeGenerationData).toBeUndefined()
  })
})
