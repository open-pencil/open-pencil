import { describe, expect, setDefaultTimeout, test } from 'bun:test'

import { encodeArchive, open } from '#core-tests/helpers/fig/archive'

import { exportFigFile } from '@open-pencil/core/io/formats/fig'
import { parseFigBuffer } from '@open-pencil/fig'
import { initCodec } from '@open-pencil/kiwi/fig/codec'
import { SceneGraph, type Fill, type SceneNode } from '@open-pencil/scene-graph'
import { computeImageHash } from '@open-pencil/scene-graph/images'
import { expectDefined } from '@open-pencil/test-support/assert'

import { releaseFigArchive } from '#core/kiwi/fig/session/archive/access'

setDefaultTimeout(60_000)

const PHOTO = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 7, 7, 7])
const PHOTO_NAME = computeImageHash(PHOTO)

/** The archive's contrast, -0.25 at 0.3 scale, as the 32-bit float it keeps. */
const ARCHIVE_CONTRAST = Math.fround(-0.075)

/** Every adjustment Figma's image panel offers, as the archive names and scales them. */
const PAINT_FILTER = {
  exposure: 0.5,
  contrast: ARCHIVE_CONTRAST,
  vibrance: 0.75,
  temperature: -0.5,
  tint: 0.125,
  highlights: -0.75,
  shadows: 0.25
}

const FILTERS = {
  exposure: 0.5,
  contrast: ARCHIVE_CONTRAST / 0.3,
  saturation: 0.75,
  temperature: -0.5,
  tint: 0.125,
  highlights: -0.75,
  shadows: 0.25
}

/** A file with one layer filled and stroked with an adjusted image, as Figma saves one. */
async function adjustedPhotoArchive(): Promise<Uint8Array> {
  await initCodec()
  const source = new SceneGraph()
  source.images.set(PHOTO_NAME, PHOTO)
  const image: Fill = {
    type: 'IMAGE',
    color: { r: 0, g: 0, b: 0, a: 1 },
    opacity: 1,
    visible: true,
    imageHash: PHOTO_NAME,
    imageScaleMode: 'FILL'
  }
  source.createNode('RECTANGLE', source.getPages()[0].id, {
    name: 'Photo',
    width: 40,
    height: 40,
    fills: [image],
    strokes: [{ ...image, weight: 4, align: 'INSIDE' }]
  })
  const parsed = parseFigBuffer((await exportFigFile(source)).slice().buffer as ArrayBuffer)
  for (const record of parsed.nodeChanges)
    for (const paint of [...(record.fillPaints ?? []), ...(record.strokePaints ?? [])])
      if (paint.type === 'IMAGE') paint.paintFilter = { ...PAINT_FILTER }
  return encodeArchive(parsed, [{ name: `images/${PHOTO_NAME}`, data: PHOTO }])
}

function photoIn(graph: SceneGraph): SceneNode {
  return expectDefined(
    [...graph.nodes.values()].find((node) => node.name === 'Photo'),
    'photo layer'
  )
}

describe('roundtrip: image adjustments', () => {
  test.each([
    ['into the archive it opened from', false],
    ['whole', true]
  ])(
    'an edited image fill and stroke keep their adjustments when the file is saved %s',
    async (_way, whole) => {
      const graph = await open(await adjustedPhotoArchive())
      const photo = photoIn(graph)
      graph.updateNode(photo.id, {
        fills: [{ ...photo.fills[0], opacity: 0.5 }],
        strokes: [{ ...photo.strokes[0], imageScaleMode: 'FIT' }]
      })
      if (whole) releaseFigArchive(graph)

      const saved = await exportFigFile(graph)
      const record = expectDefined(
        parseFigBuffer(saved.slice().buffer as ArrayBuffer).nodeChanges.find(
          (candidate) => candidate.name === 'Photo'
        ),
        'saved photo record'
      )
      expect(record.fillPaints?.[0]?.opacity).toBe(0.5)
      expect(record.strokePaints?.[0]?.imageScaleMode).toBe('FIT')
      expect(record.fillPaints?.[0]?.paintFilter).toEqual(PAINT_FILTER)
      expect(record.strokePaints?.[0]?.paintFilter).toEqual(PAINT_FILTER)

      const reopened = photoIn(await open(saved))
      expect(reopened.fills[0].filters).toEqual(FILTERS)
      expect(reopened.strokes[0].filters).toEqual(FILTERS)
    }
  )
})
