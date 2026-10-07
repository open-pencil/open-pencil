import { expect, test, useEditorSetupWithClear } from '#tests/e2e/fixtures'

const editor = useEditorSetupWithClear('/?test&no-chrome&no-rulers')

async function expectCanvas(name: string) {
  editor.canvas.assertNoErrors()
  const buffer = await editor.canvas.screenshotCanvasRegion()
  expect(buffer).toMatchSnapshot(`${name}.png`, { maxDiffPixelRatio: 0, threshold: 0 })
}

/** A card with a filled Body slot and an empty Footer slot; returns its instance. */
async function createSlottedCard(): Promise<string> {
  return editor.page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    const graph = store.graph
    const pageId = store.state.currentPageId
    const white = [
      { type: 'SOLID' as const, color: { r: 1, g: 1, b: 1, a: 1 }, visible: true, opacity: 1 }
    ]
    const card = graph.createNode('COMPONENT', pageId, {
      name: 'Card',
      x: 120,
      y: 120,
      width: 260,
      height: 220,
      fills: white,
      layoutMode: 'VERTICAL',
      itemSpacing: 12,
      paddingLeft: 16,
      paddingRight: 16,
      paddingTop: 16,
      paddingBottom: 16,
      componentPropertyDefinitions: [
        { id: 'card:body', name: 'Body', type: 'SLOT', defaultValue: '' },
        { id: 'card:footer', name: 'Footer', type: 'SLOT', defaultValue: '' }
      ]
    })
    const slot = (name: string, propertyId: string, height: number) =>
      graph.createNode('FRAME', card.id, {
        name,
        width: 228,
        height,
        layoutAlignSelf: 'STRETCH',
        fills: [],
        componentPropertyReferences: [{ propertyId, field: 'SLOT_CONTENT' }]
      })
    const body = slot('Body', 'card:body', 96)
    graph.createNode('RECTANGLE', body.id, {
      name: 'Placeholder',
      width: 120,
      height: 48,
      fills: [
        { type: 'SOLID', color: { r: 0.85, g: 0.88, b: 0.93, a: 1 }, visible: true, opacity: 1 }
      ]
    })
    slot('Footer', 'card:footer', 64)
    const instance = graph.createInstance(card.id, pageId, { x: 440, y: 120 })
    if (!instance) throw new Error('Instance not created')
    store.select([instance.id])
    store.requestRender()
    return instance.id
  })
}

test('selected instance outlines its slots and tints empty ones', async () => {
  await createSlottedCard()
  await editor.canvas.waitForRender()
  await expectCanvas('slot-outlines-instance-selected')
})

test('selected slot frame and its hovered content render in slot pink', async () => {
  const instanceId = await createSlottedCard()
  await editor.page.evaluate((id) => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    const [body] = store.graph.getChildren(id)
    store.select([body.id])
    store.state.hoveredNodeId = store.graph.getChildren(body.id)[0]?.id ?? null
    store.requestRender()
  }, instanceId)
  await editor.canvas.waitForRender()
  await expectCanvas('slot-frame-selected')
})
