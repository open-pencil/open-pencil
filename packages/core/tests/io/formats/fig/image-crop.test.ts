import { describe, expect, test } from 'bun:test'

import { exportFigFile } from '@open-pencil/core/io'
import { initCodec } from '@open-pencil/core/kiwi'
import { materializeFigArchive } from '@open-pencil/fig'
import { SceneGraph, type Fill } from '@open-pencil/scene-graph'

const HASH = '0123456789abcdef0123456789abcdef01234567'
const CROP = { m00: 0.5, m01: 0, m02: 0.25, m10: 0, m11: 0.25, m12: 0.5 }

function pngBytes(): Uint8Array {
  const png = new Uint8Array(33)
  png.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52])
  new DataView(png.buffer).setUint32(16, 4)
  new DataView(png.buffer).setUint32(20, 4)
  return png
}

async function roundTrip(fill: Partial<Fill>): Promise<Fill | undefined> {
  await initCodec()
  const source = new SceneGraph()
  source.images.set(HASH, pngBytes())
  source.createNode('RECTANGLE', source.getPages()[0].id, {
    name: 'Photo',
    width: 200,
    height: 100,
    fills: [
      {
        type: 'IMAGE',
        color: { r: 0, g: 0, b: 0, a: 1 },
        opacity: 1,
        visible: true,
        imageHash: HASH,
        ...fill
      }
    ]
  })
  const bytes = await exportFigFile(source)
  const { graph } = materializeFigArchive(bytes.buffer.slice(0) as ArrayBuffer)
  return [...graph.getAllNodes()].find((node) => node.name === 'Photo')?.fills[0]
}

describe('.fig image fills', () => {
  test('a cropped image saves and reads back as a crop with its transform', async () => {
    const fill = await roundTrip({ imageScaleMode: 'CROP', imageTransform: CROP })
    expect(fill?.imageScaleMode).toBe('CROP')
    expect(fill?.imageTransform).toEqual(CROP)
  })

  test.each(['FILL', 'FIT', 'TILE'] as const)('%s keeps its scale mode', async (imageScaleMode) => {
    expect((await roundTrip({ imageScaleMode }))?.imageScaleMode).toBe(imageScaleMode)
  })
})
