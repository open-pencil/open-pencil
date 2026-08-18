import { expect, test, useEditorSetup } from '#tests/e2e/fixtures'
import { expectDefined } from '#tests/helpers/assert'

const editor = useEditorSetup()

test('centered and bottom-aligned text selection follows the rendered text', async () => {
  for (const [textAlignHorizontal, textAlignVertical] of [
    ['CENTER', 'CENTER'],
    ['RIGHT', 'CENTER'],
    ['LEFT', 'BOTTOM']
  ] as const) {
    const geometry = await editor.page.evaluate(
      ({ horizontal, vertical }) => {
        const store = window.openPencil?.getStore?.()
        if (!store) throw new Error('OpenPencil store not initialized')
        const id = store.createShape('TEXT', 300, 250, 220, 120)
        store.graph.updateNode(id, {
          text: 'Aligned text',
          fontSize: 24,
          textAlignHorizontal: horizontal,
          textAlignVertical: vertical
        })
        store.select([id])
        store.startTextEditing(id)
        store.textEditor?.selectAll()
        store.requestRender()
        return { rects: store.textEditor?.getSelectionRects() ?? [] }
      },
      { horizontal: textAlignHorizontal, vertical: textAlignVertical }
    )
    const selection = expectDefined(geometry.rects[0], `${textAlignVertical} selection rectangle`)
    expect(selection.y).toBeGreaterThan(textAlignVertical === 'BOTTOM' ? 80 : 35)
    expect(selection.y + selection.height).toBeLessThanOrEqual(120)
    if (textAlignHorizontal === 'CENTER') expect(selection.x).toBeGreaterThan(20)
    if (textAlignHorizontal === 'RIGHT') expect(selection.x).toBeGreaterThan(40)

    await editor.page.keyboard.press('Escape')
    await editor.page.evaluate(() => {
      const store = window.openPencil?.getStore?.()
      const selectedId = store?.state.selectedIds.values().next().value
      if (selectedId) store?.graph.deleteNode(selectedId)
      store?.clearSelection()
    })
  }
})
