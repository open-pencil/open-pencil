import { describe, expect, spyOn, test } from 'bun:test'

import { scriptResult } from '#core-tests/helpers/script'

import { FigmaAPI } from '@open-pencil/core/figma-api'
import { SceneGraph } from '@open-pencil/scene-graph'

/** A PNG's signature and header, which declare a 3 × 2 image. */
const PNG_3X2 = [
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
  0x00, 0x00, 0x00, 0x03, 0x00, 0x00, 0x00, 0x02
]

/**
 * Answers `fetch` with `respond` until the returned spy is restored. Bun's `fetch` also carries
 * `preconnect`, which the stand-in keeps.
 */
function stubFetch(respond: (url: string) => Promise<Response>) {
  const handler = (input: string | URL | Request) =>
    respond(input instanceof Request ? input.url : String(input))
  return spyOn(globalThis, 'fetch').mockImplementation(
    Object.assign(handler, { preconnect: fetch.preconnect })
  )
}

describe('figma.createImage', () => {
  test("gives Figma's Image: its hash, a copy of its bytes, and the size its header declares", async () => {
    expect(
      await scriptResult(`
        const image = figma.createImage(new Uint8Array(${JSON.stringify(PNG_3X2)}))
        const edited = await image.getBytesAsync()
        edited[0] = 0
        const bytes = Array.from(await image.getBytesAsync())
        const size = await image.getSizeAsync()
        const again = figma.createImage(new Uint8Array(${JSON.stringify(PNG_3X2)}))
        return { sameHash: image.hash === again.hash, bytes, size }
      `)
    ).toEqual({ sameHash: true, bytes: PNG_3X2, size: { width: 3, height: 2 } })
  })

  test('keeps the bytes it was given when the script changes its array afterwards', async () => {
    expect(
      await scriptResult(`
        const data = new Uint8Array(${JSON.stringify(PNG_3X2)})
        const image = figma.createImage(data)
        data[0] = 0
        return Array.from(await image.getBytesAsync())
      `)
    ).toEqual(PNG_3X2)
  })

  test('getSizeAsync rejects bytes with no image header it can read', async () => {
    expect(
      await scriptResult('return await figma.createImage(new Uint8Array([1, 2, 3])).getSizeAsync()')
    ).toEqual(expect.stringContaining('in getSizeAsync:'))
  })
})

describe('figma.createImageAsync', () => {
  test("fetches the URL and gives the image as createImage does, as Figma's example uses it", async () => {
    const fetchSpy = stubFetch(async () => new Response(new Uint8Array(PNG_3X2)))
    try {
      const figma = new FigmaAPI(new SceneGraph())
      const result = await scriptResult(
        `
        const image = await figma.createImageAsync('https://example.com/photo.png')
        const node = figma.createRectangle()
        const { width, height } = await image.getSizeAsync()
        node.resize(width, height)
        node.fills = [{ type: 'IMAGE', imageHash: image.hash, scaleMode: 'FILL' }]
        return {
          size: [node.width, node.height],
          fillIsImage: node.fills[0].imageHash === image.hash,
          sameAsCreateImage: image.hash === figma.createImage(new Uint8Array(${JSON.stringify(PNG_3X2)})).hash,
          bytes: Array.from(await image.getBytesAsync())
        }
      `,
        figma
      )

      expect(result).toEqual({
        size: [3, 2],
        fillIsImage: true,
        sameAsCreateImage: true,
        bytes: PNG_3X2
      })
      expect(fetchSpy.mock.calls.map(([input]) => String(input))).toEqual([
        'https://example.com/photo.png'
      ])
    } finally {
      fetchSpy.mockRestore()
    }
  })

  test('rejects with the status when the server refuses, or the reason when it cannot connect, and stores nothing', async () => {
    const fetchSpy = stubFetch(async (url) => {
      if (url.endsWith('/offline.png')) throw new TypeError('Unable to connect')
      return new Response('Not found', { status: 404 })
    })
    try {
      const figma = new FigmaAPI(new SceneGraph())
      const result = await scriptResult(
        `
        const attempt = (src) => figma.createImageAsync(src).then(() => null, (error) => error.message)
        return [
          await attempt('https://example.com/missing.png'),
          await attempt('https://example.com/offline.png')
        ]
      `,
        figma
      )

      expect(result).toEqual([
        expect.stringMatching(/in createImageAsync: .*https:\/\/example\.com\/missing\.png.*404/),
        expect.stringMatching(
          /in createImageAsync: .*https:\/\/example\.com\/offline\.png.*Unable to connect/
        )
      ])
      expect(figma.graph.images.size).toBe(0)
    } finally {
      fetchSpy.mockRestore()
    }
  })
})
