import { expect, test } from 'bun:test'

import { buildFigmaClipboardHTML } from '@lawha/core/clipboard'
import { FigmaAPI } from '@lawha/core/figma-api'
import { parseFigmaClipboard } from '@lawha/fig/clipboard'
import { initCodec } from '@lawha/kiwi/fig/codec'
import { SceneGraph } from '@lawha/scene-graph'

// Valid PNG: Figma validates the embedded bytes against the SHA-1 image reference.
const bytes = new Uint8Array(
  await Bun.file('tests/fixtures/vectorize/python_logo.png').arrayBuffer()
)

test('Figma clipboard embeds shared image bytes once with SHA-1 references', async () => {
  await initCodec()
  const graph = new SceneGraph()
  const page = graph.getPages()[0]
  const { hash } = new FigmaAPI(graph).createImage(bytes)
  const nodes = [0, 1].map((index) =>
    graph.createNode('RECTANGLE', page.id, {
      name: `Image ${index}`,
      width: 40,
      height: 40,
      fills: [
        {
          type: 'IMAGE',
          color: { r: 0, g: 0, b: 0, a: 1 },
          opacity: 1,
          visible: true,
          imageHash: hash,
          imageScaleMode: 'FILL'
        }
      ]
    })
  )
  const html = await buildFigmaClipboardHTML(nodes, graph)
  if (!html) throw new Error('Missing clipboard HTML')
  const parsed = await parseFigmaClipboard(html)
  if (!parsed) throw new Error('Invalid clipboard HTML')
  const paints = parsed.nodes.flatMap((node) => node.fillPaints ?? [])
  expect(paints).toHaveLength(2)
  const expectedHash = new Uint8Array(await crypto.subtle.digest('SHA-1', bytes))
  const firstIndex = paints[0].image?.dataBlob
  expect(firstIndex).toBeDefined()
  for (const paint of paints) {
    expect(paint.image?.hash).toEqual(expectedHash)
    expect(paint.image?.dataBlob).toBe(firstIndex)
    expect(parsed.blobs[paint.image?.dataBlob ?? -1]).toEqual(bytes)
  }
  expect(nodes[0].fills[0].imageHash).toBe(hash)
  expect(graph.images.get(hash)).toEqual(bytes)
})
