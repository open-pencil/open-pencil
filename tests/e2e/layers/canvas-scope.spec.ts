import { expect, test, useEditorSetupWithClear } from '#tests/e2e/fixtures'

// Figma has no entered container: a layer picked in the layers panel leaves canvas clicks just as
// selecting it on the canvas does (scratch/pr-oracle/scope-outline.ts), so the panel enters what
// a canvas click on the layer would, and never a container that is open by itself.

const editor = useEditorSetupWithClear('/?test&no-rulers')

function scene() {
  return editor.page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    const fill = [
      { type: 'SOLID' as const, color: { r: 0.9, g: 0.9, b: 0.9, a: 1 }, opacity: 1, visible: true }
    ]
    const page = store.state.currentPageId
    const section = store.graph.createNode('SECTION', page, {
      name: 'Section',
      width: 500,
      height: 400,
      fills: fill
    })
    const top = store.graph.createNode('FRAME', section.id, {
      name: 'Top',
      x: 40,
      y: 40,
      width: 400,
      height: 300,
      fills: fill
    })
    const inner = store.graph.createNode('FRAME', top.id, {
      name: 'Inner',
      x: 40,
      y: 40,
      width: 300,
      height: 200,
      fills: fill
    })
    const a = store.graph.createNode('RECTANGLE', inner.id, {
      name: 'A',
      x: 40,
      y: 40,
      width: 60,
      height: 60,
      fills: fill
    })
    const c = store.graph.createNode('RECTANGLE', top.id, {
      name: 'C',
      x: 20,
      y: 260,
      width: 30,
      height: 30,
      fills: fill
    })
    // Selecting both opens their rows in the tree.
    store.select([a.id, c.id])
    store.clearSelection()
    return { inner: inner.id, a: a.id, c: c.id }
  })
}

function entered() {
  return editor.page.evaluate(
    () => window.openPencil?.getStore?.().state.enteredContainerId ?? null
  )
}

test('a layer picked in the layers panel enters only what a canvas click on it would', async () => {
  const ids = await scene()
  await editor.canvas.waitForRender()

  // C sits in a top-level frame, which a click looks into by itself: nothing is entered.
  await editor.page.locator(`[data-node-id="${ids.c}"]`).click()
  await expect.poll(entered).toBeNull()

  // A sits in a nested frame: that frame is entered, as a double-click on the canvas would.
  await editor.page.locator(`[data-node-id="${ids.a}"]`).click()
  await expect.poll(entered).toBe(ids.inner)
  editor.canvas.assertNoErrors()
})
