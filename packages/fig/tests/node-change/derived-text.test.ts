import { describe, expect, spyOn, test } from 'bun:test'

import { expectDefined } from '#fig-tests/helpers/assert'
import {
  buildNodeDerivedTextData,
  convertFigmaDerivedTextGlyphs,
  type DerivedTextBuildContext,
  type ShapedText
} from '#fig/node-change/index'

import type { NodeChange } from '@open-pencil/kiwi/fig/codec'
import { SceneGraph } from '@open-pencil/scene-graph'
import type { SceneNode } from '@open-pencil/scene-graph'

const SQUARE = [
  { type: 'M', x: 0, y: 0 },
  { type: 'L', x: 8, y: 0 },
  { type: 'L', x: 8, y: -8 },
  { type: 'Z' }
]

function textNode(props: Partial<SceneNode> = {}): SceneNode {
  const graph = new SceneGraph()
  return graph.createNode('TEXT', graph.getPages()[0].id, {
    text: 'Ab c',
    width: 20,
    height: 32,
    fontSize: 16,
    ...props
  })
}

function context(shaped: ShapedText | null): DerivedTextBuildContext & { blobs: Uint8Array[] } {
  return {
    digestMap: new Map(),
    blobs: [],
    glyphBlobMap: new Map(),
    shapeText: () => shaped
  }
}

function twoLines(commands: ShapedText['glyphs'][number]['commands']): ShapedText {
  return {
    glyphs: [
      { commands, x: 0, y: 12, fontSize: 16, firstCharacter: 0, advance: 8 },
      { commands, x: 8, y: 12, fontSize: 16, firstCharacter: 1, advance: 8 },
      { commands: commands && [], x: 16, y: 12, fontSize: 16, firstCharacter: 2, advance: 4 },
      { commands, x: 0, y: 28, fontSize: 16, firstCharacter: 3, advance: 8 }
    ],
    baselines: [
      {
        firstCharacter: 0,
        endCharacter: 3,
        position: { x: 0, y: 12 },
        width: 20,
        lineY: 0,
        lineHeight: 16,
        lineAscent: 12
      },
      {
        firstCharacter: 3,
        endCharacter: 4,
        position: { x: 0, y: 28 },
        width: 8,
        lineY: 16,
        lineHeight: 16,
        lineAscent: 12
      }
    ],
    logicalIndexToCharacterOffsetMap: [0, 8, 16, 0]
  }
}

describe('derived text writer', () => {
  test('writes shaped lines with em advances and deduplicated outlines', () => {
    const writer = context(twoLines(SQUARE))
    const data = expectDefined(buildNodeDerivedTextData(textNode(), writer), 'derived text')
    const glyphs = expectDefined(data.glyphs, 'glyphs')

    expect(data.baselines).toHaveLength(2)
    expect(glyphs.map((glyph) => glyph.position.y)).toEqual([12, 12, 12, 28])
    expect(glyphs[0].advance).toBe(0.5)
    expect(data.logicalIndexToCharacterOffsetMap).toEqual([0, 8, 16, 0])
    expect(glyphs[0].commandsBlob).toBe(glyphs[1].commandsBlob)
    // Figma writes whitespace as a lone close command.
    expect([...writer.blobs[expectDefined(glyphs[2].commandsBlob, 'space blob')]]).toEqual([0])
    expect(writer.blobs).toHaveLength(2)
  })

  test('writes the layout without outlines when the shaper has none', () => {
    const writer = context(twoLines(null))
    const data = expectDefined(buildNodeDerivedTextData(textNode(), writer), 'derived text')

    expect(data.baselines).toHaveLength(2)
    expect(data.glyphs?.every((glyph) => glyph.commandsBlob === undefined)).toBe(true)
    expect(writer.blobs).toHaveLength(0)
  })

  test('writes no glyphs for text that could not be shaped', () => {
    const data = expectDefined(buildNodeDerivedTextData(textNode(), context(null)), 'derived')

    expect(data.glyphs).toEqual([])
    expect(data.baselines).toEqual([])
    expect(data.layoutSize).toEqual({ x: 20, y: 32 })
  })

  test('writes no glyphs, rather than failing, when the shaper throws', () => {
    const writer = context(null)
    writer.shapeText = () => {
      throw new Error('shaper failed')
    }
    const warn = spyOn(console, 'warn').mockImplementation(() => undefined)
    try {
      const data = expectDefined(buildNodeDerivedTextData(textNode(), writer), 'derived text')

      expect(data.glyphs).toEqual([])
      expect(warn).toHaveBeenCalledTimes(1)
    } finally {
      warn.mockRestore()
    }
  })

  test('keeps saved glyphs on the lines they were placed on', () => {
    const blob = new Uint8Array([0])
    const node = textNode({
      derivedTextGlyphs: [
        { commandsBlob: blob, x: 0, y: 12, fontSize: 16, firstCharacter: 0 },
        { commandsBlob: blob, x: 8, y: 12, fontSize: 16, firstCharacter: 1 },
        { commandsBlob: blob, x: 2, y: 28, fontSize: 16, firstCharacter: 3 }
      ]
    })
    const data = expectDefined(buildNodeDerivedTextData(node, context(null)), 'derived text')

    expect(data.baselines?.map((line) => [line.firstCharacter, line.endCharacter])).toEqual([
      [0, 3],
      [3, 4]
    ])
    expect(data.baselines?.[1].position).toEqual({ x: 2, y: 28 })
    expect(data.logicalIndexToCharacterOffsetMap).toEqual([0, 8, 0, 0])
    expect(data.glyphs?.map((glyph) => glyph.advance)).toEqual([0.5, 0, 0])
  })

  test('names font styles as Figma does', () => {
    const data = buildNodeDerivedTextData(
      textNode({ fontFamily: 'Inter', fontWeight: 600 }),
      context(null)
    )

    expect(data?.fontMetaData?.[0].key.style).toBe('Semi Bold')
  })
})

type DerivedTextData = NonNullable<NodeChange['derivedTextData']>

function earlierOpenPencilData(characters: string, lineHeight: number): DerivedTextData {
  return {
    baselines: [
      {
        firstCharacter: 0,
        endCharacter: characters.length - 1,
        position: { x: 0, y: lineHeight },
        width: 230,
        lineHeight,
        lineAscent: lineHeight - 2.6
      }
    ],
    glyphs: Array.from(characters, (_, index) => ({
      commandsBlob: 0,
      position: { x: index * 7, y: lineHeight },
      fontSize: 13,
      firstCharacter: index,
      advance: 7,
      rotation: 0
    })),
    logicalIndexToCharacterOffsetMap: Array.from(
      { length: characters.length + 1 },
      (_, index) => index * 7
    )
  }
}

describe('derived text reader', () => {
  const blobs = [new Uint8Array([0])]

  test('drops one-line glyphs an earlier OpenPencil wrote without shaping (#914)', () => {
    const characters = 'A sentence long enough that it has to wrap onto a second line.'

    expect(
      convertFigmaDerivedTextGlyphs(earlierOpenPencilData(characters, 16), blobs, characters)
    ).toEqual([])
  })

  test('keeps Figma glyphs, whose offset map has one entry per character', () => {
    const characters = 'Table item'
    const data = earlierOpenPencilData(characters, 16)
    data.logicalIndexToCharacterOffsetMap = data.logicalIndexToCharacterOffsetMap?.slice(0, -1)

    expect(convertFigmaDerivedTextGlyphs(data, blobs, characters)).toHaveLength(characters.length)
  })

  test('keeps Figma glyphs an earlier OpenPencil carried over', () => {
    const characters = 'Table item'
    const data = earlierOpenPencilData(characters, 20)
    for (const glyph of data.glyphs ?? []) glyph.position.y = 15.09

    expect(convertFigmaDerivedTextGlyphs(data, blobs, characters)).toHaveLength(characters.length)
  })

  test('drops glyphs when any of them has no outline', () => {
    const characters = 'Hi'
    const data: DerivedTextData = {
      glyphs: [
        {
          commandsBlob: 0,
          position: { x: 0, y: 12 },
          fontSize: 16,
          firstCharacter: 0,
          advance: 0.5
        },
        { position: { x: 8, y: 12 }, fontSize: 16, firstCharacter: 1, advance: 0.5 }
      ],
      logicalIndexToCharacterOffsetMap: [0, 8]
    }

    expect(convertFigmaDerivedTextGlyphs(data, blobs, characters)).toEqual([])
  })
})
