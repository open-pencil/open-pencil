import { describe, expect, test } from 'bun:test'

import { bytesToHex, hexToBytes } from '#fig/node-change/bytes'
import { figImageEntries, nameImagesForFigma } from '#fig/node-change/images'

import type { NodeChange } from '@open-pencil/kiwi/fig/codec'
import { computeImageHash } from '@open-pencil/scene-graph/images'
import {
  OPEN_PENCIL_PLUGIN_DATA,
  OPEN_PENCIL_PLUGIN_ID
} from '@open-pencil/scene-graph/plugin-data'

const STILL = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3])
/** A shader still's own name, which is not the SHA-1 of its bytes. */
const STILL_NAME = 'aa'.repeat(20)
const FIGMA_NAME = computeImageHash(STILL)
const PRESET = { components: [{ type: 'Aurora' }] }

function imagePaint(name: string) {
  return { type: 'IMAGE' as const, image: { hash: hexToBytes(name) } }
}

/** A layer whose fill is a shader still, and a text style override that paints the same still. */
function records(): NodeChange[] {
  return [
    {
      fillPaints: [imagePaint(STILL_NAME)],
      pluginData: [
        {
          pluginID: OPEN_PENCIL_PLUGIN_ID,
          key: OPEN_PENCIL_PLUGIN_DATA.shader.key,
          value: OPEN_PENCIL_PLUGIN_DATA.shader.encode({ image: STILL_NAME, preset: PRESET })
        }
      ],
      textData: { characters: '', styleOverrideTable: [{ fillPaints: [imagePaint(STILL_NAME)] }] }
    }
  ]
}

function paintName(paint: { image?: { hash?: Uint8Array | string } } | undefined): string {
  const hash = paint?.image?.hash
  return hash instanceof Uint8Array ? bytesToHex(hash) : String(hash)
}

describe('nameImagesForFigma', () => {
  test('points every paint at the SHA-1 of its image, however deep', () => {
    const changes = records()
    const names = nameImagesForFigma(changes, new Map([[STILL_NAME, STILL]]))
    const [layer] = changes

    expect(names).toEqual(new Map([[STILL_NAME, FIGMA_NAME]]))
    expect(paintName(layer.fillPaints?.[0])).toBe(FIGMA_NAME)
    expect(paintName(layer.textData?.styleOverrideTable?.[0]?.fillPaints?.[0])).toBe(FIGMA_NAME)
  })

  test('renames the image in shader plugin data, so the shader still finds its paint', () => {
    const changes = records()
    nameImagesForFigma(changes, new Map([[STILL_NAME, STILL]]))
    const entry = changes[0].pluginData?.[0]

    expect(OPEN_PENCIL_PLUGIN_DATA.shader.decode(entry?.value)).toEqual({
      image: FIGMA_NAME,
      preset: PRESET
    })
  })

  test('leaves references to images it does not have as they are', () => {
    const changes = records()
    expect(nameImagesForFigma(changes, new Map())).toEqual(new Map())
    expect(paintName(changes[0].fillPaints?.[0])).toBe(STILL_NAME)
  })
})

describe('figImageEntries', () => {
  test('names an image no record references by its SHA-1 too', () => {
    const images = new Map([[STILL_NAME, STILL]])
    expect(figImageEntries(images, new Map())).toEqual([
      { name: `images/${FIGMA_NAME}`, data: STILL }
    ])
  })

  test('writes each image once under its new name', () => {
    const other = 'bb'.repeat(20)
    const images = new Map([
      [STILL_NAME, STILL],
      [other, STILL]
    ])
    const names = new Map([
      [STILL_NAME, FIGMA_NAME],
      [other, FIGMA_NAME]
    ])

    expect(figImageEntries(images, names)).toEqual([{ name: `images/${FIGMA_NAME}`, data: STILL }])
  })
})
