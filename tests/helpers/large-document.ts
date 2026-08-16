import type { Page } from '@playwright/test'

export type LargeDocumentProfile = {
  nodeCount: number
  leafIds: string[]
  worldWidth: number
  worldHeight: number
}

/** Build a deterministic mixed document without timing browser-side setup. */
export async function seedLargeDocument(
  page: Page,
  nodeCount: number
): Promise<LargeDocumentProfile> {
  return page.evaluate((count) => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    const graph = store.graph
    const pageId = store.state.currentPageId
    const leafIds: string[] = []
    const cards = Math.ceil(count / 10)
    const columns = Math.ceil(Math.sqrt(cards))
    const cardWidth = 240
    const cardHeight = 236
    const gap = 32

    for (let cardIndex = 0; cardIndex < cards && leafIds.length < count; cardIndex++) {
      const column = cardIndex % columns
      const row = Math.floor(cardIndex / columns)
      const frame = graph.createNode('FRAME', pageId, {
        name: `Card ${cardIndex}`,
        x: column * (cardWidth + gap),
        y: row * (cardHeight + gap),
        width: cardWidth,
        height: cardHeight,
        layoutMode: 'VERTICAL',
        itemSpacing: 8,
        paddingTop: 12,
        paddingRight: 12,
        paddingBottom: 12,
        paddingLeft: 12,
        fills: [
          {
            type: 'SOLID',
            color: { r: 0.96, g: 0.97, b: 0.99, a: 1 },
            opacity: 1,
            visible: true
          }
        ],
        effects:
          cardIndex % 4 === 0
            ? [
                {
                  type: 'DROP_SHADOW',
                  color: { r: 0, g: 0, b: 0, a: 0.12 },
                  offset: { x: 0, y: 3 },
                  radius: 8,
                  spread: 0,
                  visible: true
                }
              ]
            : []
      })

      for (let childIndex = 0; childIndex < 10 && leafIds.length < count; childIndex++) {
        const isText = childIndex % 3 === 0
        const node = graph.createNode(isText ? 'TEXT' : 'RECTANGLE', frame.id, {
          name: `${isText ? 'Label' : 'Row'} ${cardIndex}-${childIndex}`,
          text: isText ? `Item ${cardIndex}-${childIndex}` : undefined,
          width: 200,
          height: 14,
          cornerRadius: isText ? 0 : 4,
          fills: [
            {
              type: 'SOLID',
              color: isText
                ? { r: 0.12, g: 0.14, b: 0.18, a: 1 }
                : { r: 0.25, g: 0.48, b: 0.92, a: 1 },
              opacity: 1,
              visible: true
            }
          ]
        })
        leafIds.push(node.id)
      }
    }

    store.requestRender()
    const rows = Math.ceil(cards / columns)
    return {
      nodeCount: leafIds.length,
      leafIds,
      worldWidth: columns * (cardWidth + gap),
      worldHeight: rows * (cardHeight + gap)
    }
  }, nodeCount)
}
