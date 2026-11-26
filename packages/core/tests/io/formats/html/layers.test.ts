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
  test('a ring around a box without a border is its outside stroke', async () => {
    const layer = await layers(
      `<div id="ring" style="${RING}"></div>
       <div id="shadowed" style="${RING}, 0 2px 4px black"></div>
       <div id="bordered" style="${RING};border:1px solid blue"></div>
       <div id="rings" style="${RING}, 0 0 0 6px blue"></div>`
    )
    expect(layer('ring')).toMatchObject({
      clipsContent: false,
      strokes: [{ color: { r: 1, g: 0, b: 0 }, weight: 3, align: 'OUTSIDE' }],
      effects: []
    })
    // An outside stroke would grow the other shadow, which CSS casts from the box alone.
    expect(layer('shadowed').strokes).toEqual([])
    expect(layer('shadowed').effects).toHaveLength(2)
    expect(layer('bordered').strokes).toMatchObject([{ align: 'INSIDE' }])
    expect(layer('bordered').effects).toMatchObject([{ spread: 3 }])
    expect(layer('rings').strokes).toEqual([])
    expect(layer('rings').effects).toHaveLength(2)
  })

  test('a transparent border is the room it takes, so a ring beside it is a stroke', async () => {
    const layer = await layers(
      `<div id="clear" style="display:flex;padding:4px 6px;border:1px solid transparent;box-shadow:0 0 0 3px red"><i style="display:block;width:9px;height:9px;background:blue"></i></div>`
    )
    expect(layer('clear')).toMatchObject({
      paddingTop: 5,
      paddingRight: 7,
      paddingBottom: 5,
      paddingLeft: 7,
      strokes: [{ weight: 3, align: 'OUTSIDE' }],
      effects: []
    })
  })

  test('a decoration draws through flex items but not inline blocks or absolute boxes', async () => {
    const layer = await layers(
      `<div style="display:flex;text-decoration:underline"><span>Item</span></div>
       <div style="text-decoration:underline;position:relative;height:50px"><b style="display:inline-block;padding:2px">Block</b><u style="position:absolute;top:20px;text-decoration:none">Out</u><p style="float:left;padding:1px">Float</p></div>`
    )
    expect(layer('Item').textDecoration).toBe('UNDERLINE')
    expect(layer('Block').textDecoration).toBe('NONE')
    expect(layer('Float').textDecoration).toBe('NONE')
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
