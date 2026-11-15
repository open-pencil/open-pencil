import { describe, expect, test } from 'bun:test'

import { exportFigFile, parseFigFile } from '@open-pencil/core/io/formats/fig'
import { layoutAuthoredNodes } from '@open-pencil/core/layout'
import { initCodec } from '@open-pencil/kiwi/fig/codec'
import { parsePenFile, type PenDocument, type PenNode } from '@open-pencil/pen'

const button: PenNode = {
  id: 'button',
  type: 'frame',
  name: 'Button',
  reusable: true,
  children: [{ id: 'dot', type: 'ellipse', width: 8, height: 8 }]
}
const card: PenNode = {
  id: 'card',
  type: 'frame',
  name: 'Card',
  reusable: true,
  layout: 'vertical',
  children: [
    { id: 'title', type: 'text', content: 'Card title' },
    { id: 'cardButton', type: 'ref', ref: 'button' }
  ]
}
const badge: PenNode = {
  id: 'badge',
  type: 'frame',
  name: 'Badge',
  reusable: true,
  children: [{ id: 'badgeLabel', type: 'text', content: 'New' }]
}

describe('.pen instances saved as .fig', () => {
  test('keep a nested instance an override swaps for another component', async () => {
    await initCodec()
    const document: PenDocument = {
      version: '2.21',
      children: [
        button,
        card,
        badge,
        {
          id: 'withBadge',
          type: 'ref',
          ref: 'card',
          name: 'Promo',
          descendants: {
            cardButton: {
              type: 'ref',
              ref: 'badge',
              descendants: { badgeLabel: { content: 'Sale' } }
            }
          }
        }
      ]
    }
    const graph = parsePenFile(JSON.stringify(document), {
      layout: (target) =>
        layoutAuthoredNodes(
          target,
          target.getPages().map((page) => page.id)
        )
    })
    const reopened = await parseFigFile((await exportFigFile(graph)).buffer as ArrayBuffer)
    const promo = [...reopened.getAllNodes()].find((node) => node.name === 'Promo')
    const nested = promo ? reopened.getChildren(promo.id)[1] : undefined

    expect(promo?.type).toBe('INSTANCE')
    expect(nested?.type).toBe('INSTANCE')
    expect(reopened.getNode(nested?.componentId ?? '')?.name).toBe('Badge')
    expect(reopened.getChildren(nested?.id ?? '').map((node) => node.text)).toEqual(['Sale'])
  })
})
