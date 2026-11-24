import { describe, expect, test } from 'bun:test'

import { readHTMLDocument } from '#core/io/formats/html/import'

const STYLE = `<style>
  body { margin: 0 }
  .pic { position: relative; width: 200px; height: 100px; background: #2563eb }
  .pic::before { content: ""; position: absolute; inset: 0; z-index: -1; background: #eee }
  .badge { position: absolute; top: 4px; right: 4px; z-index: 2; width: 40px; height: 16px; background: #111 }
  .caption { position: absolute; bottom: 4px; left: 4px; width: 60px; height: 16px; background: #fff }
  .context { isolation: isolate }
</style>`

async function layersOf(html: string) {
  const { graph } = await readHTMLDocument(STYLE + html)
  const [pic] = graph.getChildren(graph.getPages()[0].id)
  return { graph, pic }
}

describe('z-index in imported HTML', () => {
  test('paints positioned children in z-index order, a negative one under the background', async () => {
    const { graph, pic } = await layersOf(
      '<div class="pic"><span class="badge"></span><span class="caption"></span></div>'
    )
    const children = graph.getChildren(pic.id)

    // The ::before goes under the box's own background, which moves to a layer above it; the badge
    // paints over the caption that follows it in the page.
    expect(children.map((child) => child.name)).toEqual([
      '::before',
      'background',
      'caption',
      'badge'
    ])
    expect(pic.fills).toEqual([])
    expect(children[1]).toMatchObject({ x: 0, y: 0, width: 200, height: 100 })
    expect(children[1]?.fills[0]?.color).toMatchObject({
      r: 0x25 / 255,
      g: 0x63 / 255,
      b: 0xeb / 255
    })
  })

  test('keeps the background of a box that is a stacking context, under every child', async () => {
    const { graph, pic } = await layersOf(
      '<div class="pic context"><span class="badge"></span><span class="caption"></span></div>'
    )

    expect(graph.getChildren(pic.id).map((child) => child.name)).toEqual([
      '::before',
      'caption',
      'badge'
    ])
    expect(pic.fills.map((fill) => fill.type)).toEqual(['SOLID'])
  })

  test('paints a positioned box after the boxes in the flow that follow it, as an icon over a field', async () => {
    const { graph } = await readHTMLDocument(`<style>
      body { margin: 0 }
      .search { position: relative; width: 240px }
      .icon { position: absolute; left: 12px; top: 12px; width: 16px; height: 16px; background: #111 }
      .field { height: 40px; background: #fff }
    </style>
    <div class="search"><span class="icon"></span><div class="field"></div></div>`)
    const [search] = graph.getChildren(graph.getPages()[0].id)

    expect(graph.getChildren(search?.id ?? '').map((child) => child.name)).toEqual([
      'field',
      'icon'
    ])
  })
})
