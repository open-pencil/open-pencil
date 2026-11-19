import { describe, expect, setDefaultTimeout, test } from 'bun:test'

import { unzipSync, zipSync } from 'fflate'

import { exportFigFile, parseFigFile } from '@open-pencil/core/io/formats/fig'
import { parseFigBuffer } from '@open-pencil/fig'
import { initCodec, type Paint } from '@open-pencil/kiwi/fig/codec'
import { SceneGraph, type Fill } from '@open-pencil/scene-graph'
import { expectDefined } from '@open-pencil/test-support/assert'
import { collectAllNodes } from '@open-pencil/test-support/fig/traversal'

setDefaultTimeout(60_000)

const POSTER = '1'.repeat(40)
const CLIP = '2'.repeat(40)

const video: Fill = {
  type: 'VIDEO',
  color: { r: 0, g: 0, b: 0, a: 1 },
  opacity: 1,
  visible: true,
  imageHash: POSTER,
  videoHash: CLIP,
  imageScaleMode: 'FIT'
}

function graphWithVideo(): SceneGraph {
  const graph = new SceneGraph()
  graph.createNode('RECTANGLE', graph.getPages()[0].id, {
    name: 'Video',
    width: 160,
    height: 90,
    fills: [video],
    strokes: [{ ...video, weight: 2, align: 'INSIDE' }]
  })
  return graph
}

function hex(hash: string | Uint8Array | undefined): string | undefined {
  if (hash === undefined || typeof hash === 'string') return hash
  return Buffer.from(hash).toString('hex')
}

function savedPaints(bytes: Uint8Array): Paint[] {
  const { nodeChanges } = parseFigBuffer(bytes.slice().buffer)
  const record = expectDefined(
    nodeChanges.find((change) => change.name === 'Video'),
    'saved record'
  )
  return [...(record.fillPaints ?? []), ...(record.strokePaints ?? [])]
}

describe('roundtrip: video paints', () => {
  test('a saved video paint names its clip and its poster frame', async () => {
    await initCodec()
    const paints = savedPaints(await exportFigFile(graphWithVideo()))

    expect(
      paints.map((paint) => [paint.type, hex(paint.video?.hash), hex(paint.image?.hash)])
    ).toEqual([
      ['VIDEO', CLIP, POSTER],
      ['VIDEO', CLIP, POSTER]
    ])
  })

  test('a video fill and stroke read back with their clip, poster frame, and scale mode', async () => {
    await initCodec()
    const reread = await parseFigFile((await exportFigFile(graphWithVideo())).buffer as ArrayBuffer)
    const node = expectDefined(
      collectAllNodes(reread).find((candidate) => candidate.name === 'Video'),
      'node'
    )

    for (const paint of [node.fills[0], node.strokes[0]]) {
      expect(paint).toMatchObject({
        type: 'VIDEO',
        imageHash: POSTER,
        videoHash: CLIP,
        imageScaleMode: 'FIT'
      })
    }
  })

  test('a file saved into its archive keeps the video clips it holds', async () => {
    await initCodec()
    const clip = new Uint8Array([0, 0, 0, 24, 102, 116, 121, 112])
    const archive = unzipSync(await exportFigFile(graphWithVideo()))
    const withClip = zipSync({ ...archive, [`videos/${CLIP}`]: clip })
    const opened = await parseFigFile(withClip.slice().buffer, { populate: 'first-page' })
    const node = expectDefined(
      collectAllNodes(opened).find((candidate) => candidate.name === 'Video'),
      'node'
    )
    opened.updateNode(node.id, { name: 'Video renamed' })

    const saved = unzipSync(await exportFigFile(opened))

    expect(saved[`videos/${CLIP}`]).toEqual(clip)
  })
})
