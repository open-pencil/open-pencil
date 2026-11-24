import { describe, expect, test } from 'bun:test'

import { readHTMLDocument } from '@open-pencil/core/io/formats/html/import'

async function layers(html: string) {
  const { graph } = await readHTMLDocument(html)
  return (name: string) => {
    const node = [...graph.getAllNodes()].find((candidate) => candidate.name === name)
    if (!node) throw new Error(`No ${name}`)
    return node
  }
}

const RING = 'background:white;width:60px;height:30px;box-shadow:0 0 0 3px red'

describe('what CSS draws', () => {
  test('a spread shadow clips a box that holds its content, so it draws spread', async () => {
    const layer = await layers(
      `<div id="held" style="${RING}"><i id="in" style="display:block;width:9px;height:9px;background:blue"></i></div>
       <div id="overflows" style="${RING}"><i style="display:block;width:90px;height:9px;background:blue"></i></div>
       <div id="plain" style="background:white;width:60px;height:30px"></div>`
    )
    expect(layer('held').clipsContent).toBe(true)
    expect(layer('overflows').clipsContent).toBe(false)
    expect(layer('plain').clipsContent).toBe(false)
  })

  test('a decoration draws through flex items but not inline blocks or absolute boxes', async () => {
    const layer = await layers(
      `<div style="display:flex;text-decoration:underline"><span>Item</span></div>
       <div style="text-decoration:underline;position:relative;height:50px"><b style="display:inline-block;padding:2px">Block</b><u style="position:absolute;top:20px;text-decoration:none">Out</u></div>`
    )
    expect(layer('Item').textDecoration).toBe('UNDERLINE')
    expect(layer('Block').textDecoration).toBe('NONE')
    expect(layer('Out').textDecoration).toBe('NONE')
  })

  test('translate moves by a length and a percentage of the box together', async () => {
    const layer = await layers(
      '<div style="width:60px;height:30px"><i id="thumb" style="display:block;width:16px;height:16px;background:blue;translate:calc(100% - 2px)"></i></div>'
    )
    expect(layer('thumb').x).toBeCloseTo(14, 3)
  })

  test('a reset that gives borders a style and no width makes no boxes', async () => {
    const layer = await layers('<style>*{border:0 solid}</style><p>Words</p>')
    expect(layer('Words').parentId).toBe(layer('DesignDOM').id)
  })
})
