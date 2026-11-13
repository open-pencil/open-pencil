import { expect, setDefaultTimeout, test } from 'bun:test'

import { encodeArchive, open } from '#core-tests/helpers/fig/archive'
import { layerNamed, recordsOf } from '#core-tests/helpers/fig/patch'

import { exportFigFile } from '@open-pencil/core/io/formats/fig'
import { parseFigBuffer } from '@open-pencil/fig'
import { initCodec, type NodeChange } from '@open-pencil/kiwi/fig/codec'
import { SceneGraph } from '@open-pencil/scene-graph'
import { computeImageHash } from '@open-pencil/scene-graph/images'

setDefaultTimeout(60_000)

test('an archive whose images Figma cannot read is written whole, every image by its SHA-1', async () => {
  const graph = await open(await legacyImageArchive())
  graph.updateNode(layerNamed(graph, 'Photo 0').id, { name: 'Edited' })

  for (const saved of [
    await exportFigFile(graph),
    await exportFigFile(await open(await legacyImageArchive()))
  ]) {
    const photos = [...recordsOf(saved).values()].filter((record) => record.fillPaints?.length)
    const parsed = parseFigBuffer(saved.slice().buffer as ArrayBuffer)
    expect(photos.map((record) => paintImageName(record))).toEqual([PHOTO_NAME, PHOTO_NAME])
    expect(parsed.images.map(([name]) => name)).toEqual([PHOTO_NAME])
  }
})

const PHOTO = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 7, 7, 7])
const PHOTO_NAME = computeImageHash(PHOTO)
/** A name an image had before images were named by their SHA-1. */
const LEGACY_NAME = '0123456789abcdef0123456789abcdef01234567'

function paintImageName(record: NodeChange): string | undefined {
  const hash = record.fillPaints?.[0]?.image?.hash
  return hash instanceof Uint8Array ? Buffer.from(hash).toString('hex') : undefined
}

/** Two layers painted with one image that the archive holds under a legacy name. */
async function legacyImageArchive(): Promise<Uint8Array> {
  await initCodec()
  const source = new SceneGraph()
  source.images.set(PHOTO_NAME, PHOTO)
  for (const index of [0, 1]) {
    source.createNode('RECTANGLE', source.getPages()[0].id, {
      name: `Photo ${index}`,
      x: index * 50,
      width: 40,
      height: 40,
      fills: [
        {
          type: 'IMAGE',
          color: { r: 0, g: 0, b: 0, a: 1 },
          opacity: 1,
          visible: true,
          imageHash: PHOTO_NAME,
          imageScaleMode: 'FILL'
        }
      ]
    })
  }
  const parsed = parseFigBuffer((await exportFigFile(source)).slice().buffer as ArrayBuffer)
  for (const record of parsed.nodeChanges) {
    const image = record.fillPaints?.[0]?.image
    if (image) image.hash = Uint8Array.from(Buffer.from(LEGACY_NAME, 'hex'))
  }
  return encodeArchive(parsed, [{ name: `images/${LEGACY_NAME}`, data: PHOTO }])
}
