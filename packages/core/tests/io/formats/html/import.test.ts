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
})
