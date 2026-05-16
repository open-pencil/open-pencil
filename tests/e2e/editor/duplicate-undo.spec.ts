import { expect, test, useEditorSetupWithClear } from '#tests/e2e/fixtures'

const editor = useEditorSetupWithClear('/?test')

async function rectangleCount() {
  return editor.page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    return [...store.graph.nodes.values()].filter((node) => node.type === 'RECTANGLE').length
  })
}

async function layerItems() {
  return editor.page.getByTestId('layers-item').allTextContents()
}

async function historyState() {
  return editor.page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    return {
      canUndo: store.undo.canUndo,
      canRedo: store.undo.canRedo,
      undoLabel: store.undo.undoLabel,
      redoLabel: store.undo.redoLabel
    }
  })
}

test('undo after option-drag duplicate removes the copy', async () => {
  await editor.canvas.drawRect(120, 120, 120, 90)
  await expect.poll(rectangleCount).toBe(1)

  await editor.canvas.altDrag(180, 165, 340, 165)
  await expect.poll(rectangleCount).toBe(2)
  await expect.poll(layerItems).toEqual(['Rectangle', 'Rectangle copy'])

  await editor.canvas.undo()
  await expect.poll(rectangleCount).toBe(1)
  await expect.poll(layerItems).toEqual(['Rectangle'])
  await expect.poll(historyState).toMatchObject({ canRedo: true, redoLabel: 'Duplicate' })

  await editor.page.waitForTimeout(1500)
  await expect.poll(rectangleCount).toBe(1)
  await expect.poll(layerItems).toEqual(['Rectangle'])
  await expect.poll(historyState).toMatchObject({ canRedo: true, redoLabel: 'Duplicate' })

  await editor.page.keyboard.down('Meta')
  await editor.page.keyboard.down('Shift')
  await editor.page.keyboard.press('KeyZ')
  await editor.page.keyboard.up('Shift')
  await editor.page.keyboard.up('Meta')
  await editor.canvas.waitForRender()
  await expect.poll(rectangleCount).toBe(2)
  await expect.poll(layerItems).toEqual(['Rectangle', 'Rectangle copy'])
  await expect.poll(historyState).toMatchObject({ canUndo: true, undoLabel: 'Duplicate' })

  await editor.page.waitForTimeout(1500)
  await expect.poll(rectangleCount).toBe(2)
  await expect.poll(layerItems).toEqual(['Rectangle', 'Rectangle copy'])
  await expect.poll(historyState).toMatchObject({ canUndo: true, undoLabel: 'Duplicate' })
  editor.canvas.assertNoErrors()
})
