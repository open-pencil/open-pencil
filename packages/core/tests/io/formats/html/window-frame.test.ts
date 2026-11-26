import { describe, expect, test } from 'bun:test'

import { readHTMLDocument } from '#core/io/formats/html/import'

const PAGE = `<style>
  body { margin: 0; background: #f0f4f8 }
  main { height: 1600px }
  .drawer { position: fixed; top: 0; right: -450px; width: 450px; height: 900px; background: #111 }
</style>
<main>Content</main><aside class="drawer"></aside>`

describe('a web page in its window', () => {
  test('sits in a frame as wide as the window and as tall as the page, clipping the rest', async () => {
    const { graph } = await readHTMLDocument(PAGE, { pageName: 'Shop', framed: true })
    const page = graph.getPages()[0]
    const [window, ...rest] = graph.getChildren(page.id)

    expect(rest).toEqual([])
    expect(window).toMatchObject({ type: 'FRAME', name: 'Shop', width: 1440, clipsContent: true })
    expect(window?.height).toBeGreaterThanOrEqual(1600)
    expect(window?.fills[0]?.color).toMatchObject({ r: 0xf0 / 255, g: 0xf4 / 255, b: 0xf8 / 255 })
    // The drawer is kept, past the window's right edge, where the frame clips it as a browser does.
    const drawer = graph.getChildren(window?.id ?? '').find((layer) => layer.name === 'drawer')
    expect(drawer && graph.getAbsolutePosition(drawer.id).x).toBeGreaterThanOrEqual(1440)
  })

  test('reaches down to content that overflows a short box', async () => {
    const { graph } = await readHTMLDocument(
      `<style>
        body { margin: 0 }
        .short { height: 100px }
        .tall { height: 1600px; background: #2563eb }
        .clipped { height: 100px; overflow: hidden }
        .clipped div { height: 3000px }
      </style>
      <div class="short"><div class="tall"></div></div><div class="clipped"><div></div></div>`,
      { pageName: 'Overflow', framed: true }
    )
    const [window] = graph.getChildren(graph.getPages()[0].id)

    // The tall child shows below its box, as the page scrolls to it; a clipped one does not.
    expect(window?.height).toBe(1600)
  })

  test('leaves HTML that is not a page, such as a snippet, as loose layers', async () => {
    const { graph } = await readHTMLDocument(PAGE)

    expect(graph.getChildren(graph.getPages()[0].id).map((layer) => layer.name)).toContain('drawer')
  })
})
