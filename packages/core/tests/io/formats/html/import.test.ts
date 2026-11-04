import { describe, expect, test } from 'bun:test'

import { readHTMLDocument } from '@open-pencil/core/io/formats/html/import'

// The layout from #788: a phone-sized column with a title, a card, and a button.
const DEMO = `<div style="width:390px;height:844px;background:#0b0f1a;display:flex;flex-direction:column;padding:24px;gap:16px">
  <div style="font-size:28px;font-weight:700;color:#fff">D-claro</div>
  <div style="background:#151b2b;border-radius:16px;padding:20px;color:#fff">Saldo disponible</div>
  <button style="background:#2563eb;border-radius:12px;padding:14px;color:#fff">Enviar dinero</button>
</div>`

describe('reading HTML', () => {
  test('lays out block children and flex items as a browser does', async () => {
    const { graph } = await readHTMLDocument(DEMO)
    const node = (id: string | undefined) => {
      const found = id === undefined ? undefined : graph.getNode(id)
      if (!found) throw new Error(`Missing layer ${id}`)
      return found
    }
    const column = node(graph.getPages()[0]?.childIds[0])
    const [title, card, button] = column.childIds.map(node)

    // Padding sits outside the 390px width, as CSS's content-box sizing puts it, and each
    // child fills that width, one below the other 16px apart.
    expect(column).toMatchObject({ width: 438, height: 892 })
    expect(title).toMatchObject({ x: 24, y: 24, width: 390 })
    expect(card).toMatchObject({ x: 24, y: title.y + title.height + 16, width: 390 })
    expect(button).toMatchObject({ x: 24, y: card.y + card.height + 16, width: 390 })

    // The card wraps its padding around the text, and the button centers its label.
    const cardText = node(card.childIds[0])
    expect(cardText).toMatchObject({ x: 20, y: 20 })
    expect(card.height).toBe(cardText.height + 40)
    const label = node(button.childIds[0])
    expect(label.x * 2 + label.width).toBeCloseTo(390, 0)
  })

  test('a border takes room inside the box, as in a browser', async () => {
    const { graph } = await readHTMLDocument(
      '<div style="display:inline-flex;padding:10px;border:4px solid #000"><div style="width:50px;height:50px;background:#f00"></div></div>'
    )
    const box = graph.getChildren(graph.getPages()[0].id)[0]
    const inner = graph.getChildren(box.id)[0]

    expect(box).toMatchObject({ strokesIncludedInLayout: true, width: 78, height: 78 })
    expect(inner).toMatchObject({ x: 14, y: 14 })
  })

  test('a border without a style is not drawn and takes no room', async () => {
    const { graph } = await readHTMLDocument(
      '<div style="display:inline-flex;padding:10px;border-width:4px;border-color:#000;border-style:none"><div style="width:50px;height:50px;background:#f00"></div></div>'
    )
    const box = graph.getChildren(graph.getPages()[0].id)[0]

    expect(box).toMatchObject({ strokes: [], width: 70, height: 70 })
  })

  test('a transform turns and moves the layer as it does the element', async () => {
    const { graph } = await readHTMLDocument(
      `<div style="display:flex;gap:10px">
        <div style="width:100px;height:50px;transform:rotate(30deg)"></div>
        <div style="width:100px;height:50px;transform:rotate(90deg);transform-origin:left top"></div>
        <div style="width:20px;height:20px;scale:-1 1"></div>
      </div>`
    )
    const row = graph.getChildren(graph.getPages()[0].id)[0]
    const [centered, cornered, mirrored] = graph.getChildren(row.id)

    // A turn about the center leaves the box, and the row's auto layout, where they were.
    expect(centered.rotation).toBeCloseTo(30)
    expect(centered).toMatchObject({ x: 0, y: 0 })
    // A turn about a corner moves the box; the row keeps its siblings where CSS left them.
    expect(cornered.rotation).toBeCloseTo(90)
    expect(cornered).toMatchObject({ x: 35, y: 25 })
    expect(row.layoutMode).toBe('NONE')
    expect(mirrored).toMatchObject({ x: 220, flipX: true, rotation: 0 })
  })

  test('a skew neither turns nor mirrors the layer', async () => {
    const { graph } = await readHTMLDocument(
      '<div style="width:100px;height:50px;transform:skewY(30deg)"></div>'
    )
    const box = graph.getChildren(graph.getPages()[0].id)[0]

    expect(box).toMatchObject({ rotation: 0, flipX: false })
  })

  test('text CSS does not wrap stays on one line however narrow its box', async () => {
    const { graph } = await readHTMLDocument(
      '<div style="width:100px;font-size:16px"><div style="white-space:nowrap">a long line of text that overflows</div></div>'
    )
    const box = graph.getChildren(graph.getPages()[0].id)[0]
    const text = graph.flattenTree(box.id).find(({ node }) => node.type === 'TEXT')?.node

    expect(text?.textAutoResize).toBe('WIDTH_AND_HEIGHT')
    expect(text?.width).toBeGreaterThan(100)
  })

  test('text keeps to one line when its box sets text-wrap-mode: nowrap', async () => {
    const { graph } = await readHTMLDocument(
      '<div style="width:100px;font-size:16px;text-wrap-mode:nowrap">a long line of text that overflows</div>'
    )
    const box = graph.getChildren(graph.getPages()[0].id)[0]
    const text = graph.flattenTree(box.id).find(({ node }) => node.type === 'TEXT')?.node

    expect(text?.textAutoResize).toBe('WIDTH_AND_HEIGHT')
  })

  test('generic font families set text in real ones', async () => {
    const { graph } = await readHTMLDocument(
      '<p style="font-family:system-ui, -apple-system, sans-serif">Sans</p><p style="font-family:ui-monospace, monospace">Mono</p>'
    )
    const families = graph
      .flattenTree(graph.getPages()[0].id)
      .filter(({ node }) => node.type === 'TEXT')
      .map(({ node }) => node.fontFamily)

    expect(families).toEqual(['Inter', 'Roboto Mono'])
  })
})

