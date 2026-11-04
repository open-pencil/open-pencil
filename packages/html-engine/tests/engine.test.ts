import { describe, expect, test } from 'bun:test'

import { loadHTMLEngine, rasterImageSize, type HTMLEngineCapture } from '@open-pencil/html-engine'

const VIEWPORT = { width: 800, height: 600 }

function boxOf(capture: HTMLEngineCapture, id: string) {
  const node = capture.nodes.find((candidate) => candidate.attrs?.id === id)
  if (!node?.box) throw new Error(`No box for #${id}`)
  return node.box
}

/** A baseline JPEG's start: an APP1 Exif segment with `orientation`, then a frame header. */
function jpegHeader(width: number, height: number, orientation: number): Uint8Array {
  const bytes = new Uint8Array(2 + 36 + 19)
  const view = new DataView(bytes.buffer)
  bytes.set([0xff, 0xd8])
  // APP1: marker, length 34, "Exif\0\0", then a little-endian TIFF header and one IFD entry.
  bytes.set([0xff, 0xe1], 2)
  view.setUint16(4, 34)
  bytes.set(
    [...'Exif'].map((c) => c.charCodeAt(0)),
    6
  )
  bytes.set([0x49, 0x49, 0x2a, 0x00], 12)
  view.setUint32(16, 8, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, 0x0112, true)
  view.setUint16(24, 3, true)
  view.setUint32(26, 1, true)
  view.setUint16(30, orientation, true)
  // SOF0: marker, length 17, precision, height, width.
  bytes.set([0xff, 0xc0], 38)
  view.setUint16(40, 17)
  bytes[42] = 8
  view.setUint16(43, height)
  view.setUint16(45, width)
  return bytes
}

/** A 1×1 PNG header claiming 640×480, which is all the engine reads of it. */
function pngHeader(width: number, height: number): Uint8Array {
  const bytes = new Uint8Array(33)
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  const view = new DataView(bytes.buffer)
  view.setUint32(16, width)
  view.setUint32(20, height)
  return bytes
}

describe('the HTML engine', () => {
  test('lays out block flow and flexbox as a browser does', async () => {
    const engine = await loadHTMLEngine()
    const capture = await engine.layout(
      `<body style="margin:0">
        <div id="row" style="display:flex;gap:10px;padding:20px">
          <div id="a" style="width:100px;height:50px"></div>
          <div id="b" style="flex:1;height:30px"></div>
        </div>
      </body>`,
      { viewport: VIEWPORT }
    )

    expect(boxOf(capture, 'row')).toEqual([0, 0, 800, 90])
    expect(boxOf(capture, 'a')).toEqual([20, 20, 100, 50])
    expect(boxOf(capture, 'b')).toEqual([130, 20, 650, 30])
  })

  test('reports computed styles that differ from their initial values', async () => {
    const engine = await loadHTMLEngine()
    const capture = await engine.layout(
      '<style>#card { display: flex; background: #ff0000 }</style><div id="card"></div>',
      { viewport: VIEWPORT }
    )
    const card = capture.nodes.find((node) => node.attrs?.id === 'card')

    expect(card?.style).toMatchObject({ display: 'flex', 'background-color': 'rgb(255, 0, 0)' })
    expect(card?.style?.opacity).toBeUndefined()
  })

  test('applies the stylesheets and images the host fetches', async () => {
    const engine = await loadHTMLEngine()
    const requested: string[] = []
    const capture = await engine.layout(
      '<link rel="stylesheet" href="site.css"><img id="photo" src="photo.png"><div id="box"></div>',
      {
        baseURL: 'https://example.com/page/',
        viewport: VIEWPORT,
        fetch: async (url) => {
          requested.push(url)
          if (url.endsWith('site.css')) {
            return {
              url,
              bytes: new TextEncoder().encode('#box { width: 120px; height: 40px }')
            }
          }
          if (url.endsWith('photo.png')) return { url, bytes: pngHeader(640, 480) }
          return null
        }
      }
    )

    expect(requested.toSorted()).toEqual([
      'https://example.com/page/photo.png',
      'https://example.com/page/site.css'
    ])
    expect(boxOf(capture, 'box').slice(2)).toEqual([120, 40])
    expect(boxOf(capture, 'photo').slice(2)).toEqual([640, 480])
    // Laid out from an SVG stand-in, but reported as what the page loaded.
    expect(capture.nodes.find((node) => node.attrs?.id === 'photo')?.image).toBe('raster 640x480')
  })

  test('goes on without a request that never settles', async () => {
    const engine = await loadHTMLEngine()
    let aborted = false
    const capture = await engine.layout(
      '<link rel="stylesheet" href="slow.css"><div id="box" style="height:10px"></div>',
      {
        baseURL: 'https://example.com/',
        viewport: VIEWPORT,
        requestTimeoutMs: 20,
        fetch: (_url, signal) =>
          new Promise(() => {
            signal.addEventListener('abort', () => {
              aborted = true
            })
          })
      }
    )

    expect(aborted).toBe(true)
    expect(boxOf(capture, 'box')[3]).toBe(10)
  })

  test('takes only whole positive viewport sizes', async () => {
    const engine = await loadHTMLEngine()
    for (const viewport of [
      { width: 0, height: 600 },
      { width: 800.5, height: 600 },
      { width: 800, height: -1 }
    ]) {
      await expect(engine.layout('<div></div>', { viewport })).rejects.toThrow(RangeError)
    }
  })

  test('lays out without a resource the host cannot fetch', async () => {
    const engine = await loadHTMLEngine()
    const capture = await engine.layout(
      '<link rel="stylesheet" href="missing.css"><div id="box" style="height:10px"></div>',
      { baseURL: 'https://example.com/', viewport: VIEWPORT, fetch: async () => null }
    )

    expect(boxOf(capture, 'box')[3]).toBe(10)
  })
})

describe('raster image sizes', () => {
  test('reads a PNG header', () => {
    expect(rasterImageSize(pngHeader(640, 480))).toEqual([640, 480])
  })

  test("swaps a JPEG's sides when its Exif orientation turns it a quarter", () => {
    expect(rasterImageSize(jpegHeader(640, 480, 1))).toEqual([640, 480])
    expect(rasterImageSize(jpegHeader(640, 480, 6))).toEqual([480, 640])
    expect(rasterImageSize(jpegHeader(640, 480, 8))).toEqual([480, 640])
  })

  test('is null for an AVIF cut off inside its size box', () => {
    const bytes = new TextEncoder().encode('\0\0\0\x18ftypavif\0\0\0\0avifmif1miafispe\0\0')
    expect(rasterImageSize(bytes)).toBeNull()
  })

  test('is null for bytes that are not an image it knows', () => {
    expect(rasterImageSize(new TextEncoder().encode('<svg/>'))).toBeNull()
  })
})
