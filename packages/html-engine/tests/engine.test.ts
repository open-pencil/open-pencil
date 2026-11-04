import { describe, expect, test } from 'bun:test'

import { loadHTMLEngine, rasterImageSize, type HTMLEngineCapture } from '@open-pencil/html-engine'

const VIEWPORT = { width: 800, height: 600 }

function boxOf(capture: HTMLEngineCapture, id: string) {
  const node = capture.nodes.find((candidate) => candidate.attrs?.id === id)
  if (!node?.box) throw new Error(`No box for #${id}`)
  return node.box
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

  test('is null for bytes that are not an image it knows', () => {
    expect(rasterImageSize(new TextEncoder().encode('<svg/>'))).toBeNull()
  })
})
