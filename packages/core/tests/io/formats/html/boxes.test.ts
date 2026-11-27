import { describe, expect, test } from 'bun:test'

import { readHTMLDocument } from '#core/io/formats/html/import'

describe('box styles', () => {
  test('a box that hides its overflow on one axis clips what it holds', async () => {
    const { graph } = await readHTMLDocument(
      '<div style="width:50px;height:20px;overflow-x:hidden"><div style="width:100px;height:10px;background:#f00"></div></div>'
    )
    const box = graph.getChildren(graph.getPages()[0].id)[0]

    expect(box?.clipsContent).toBe(true)
  })

  test('a fully round corner keeps a radius a layer can edit', async () => {
    const { graph } = await readHTMLDocument(
      '<div style="width:40px;height:20px;background:#f00;border-radius:calc(infinity * 1px)"></div>'
    )
    const box = graph.getChildren(graph.getPages()[0].id)[0]

    expect(box?.cornerRadius).toBe(9999)
  })
})
