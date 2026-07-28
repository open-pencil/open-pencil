import { expect, test } from 'bun:test'

import { exportSVGOrThrow, makeGraph, pageId } from './helpers'

test('embeds large image fills without overflowing the call stack', () => {
  const graph = makeGraph()
  const imageHash = 'large-png'
  const imageBytes = new Uint8Array(2_700_000)
  imageBytes.set([0x89, 0x50, 0x4e, 0x47])
  imageBytes.fill(0xa5, 4)
  graph.images.set(imageHash, imageBytes)

  const node = graph.createNode('RECTANGLE', pageId(graph), {
    width: 100,
    height: 100,
    fills: [
      {
        type: 'IMAGE',
        imageHash,
        imageScaleMode: 'FILL',
        color: { r: 0, g: 0, b: 0, a: 0 },
        opacity: 1,
        visible: true
      }
    ]
  })

  const result = exportSVGOrThrow(graph, [node.id])
  const encoded = Buffer.from(imageBytes).toString('base64')
  expect(result).toContain(`href="data:image/png;base64,${encoded}"`)
})
