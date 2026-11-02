import { expect, test, useEditorSetupWithClear } from '#tests/e2e/fixtures'
import { clickDepthDriver } from '#tests/helpers/canvas/click-depth/driver'

// Figma has no entered container: a layer picked in the layers panel leaves canvas clicks just as
// selecting it on the canvas does (scratch/pr-oracle/scope-outline.ts), so the panel enters what
// a canvas click on the layer would, and never a container that is open by itself.

const editor = useEditorSetupWithClear('/?test&no-rulers')

const scene = clickDepthDriver(() => editor.page)

test('a layer picked in the layers panel enters only what a canvas click on it would', async () => {
  const ids = await scene.scopeTree()
  await editor.canvas.waitForRender()

  // C sits in a top-level frame, which a click looks into by itself: nothing is entered.
  await editor.page.locator(`[data-node-id="${ids.c}"]`).click()
  await expect.poll(async () => (await scene.state()).entered).toBeNull()

  // A sits in a nested frame: that frame is entered, as a double-click on the canvas would.
  await editor.page.locator(`[data-node-id="${ids.a}"]`).click()
  await expect.poll(async () => (await scene.state()).entered).toBe(ids.inner)
  editor.canvas.assertNoErrors()
})
