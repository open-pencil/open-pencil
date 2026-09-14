import { CanvasHelper } from '#tests/helpers/canvas'
import { expect, test } from '#tests/helpers/chat/fixture'
import { setupPlacementScene, type PlacementScenario } from '#tests/helpers/chat/placement-scene'
import { documentSnapshot, previewKey, setupCanvas } from '#tests/helpers/chat/render-preview'
import { installRenderStream } from '#tests/helpers/chat/render-stream'

const scenarios: PlacementScenario[] = [
  'nested-fill',
  'nested-hug',
  'nested-replace',
  'top-level-replace',
  'page-insertion',
  'rotated-clip'
]

for (const scenario of scenarios) {
  test(`matches the final render for ${scenario}`, async ({ configuredChat: chat }) => {
    await setupCanvas(chat.page)
    const scene = await setupPlacementScene(chat.page, scenario)
    const before = await documentSnapshot(chat.page)
    const stream = await installRenderStream(chat.page, { ...scene, pauseAfter: ['/>'] })
    const canvas = new CanvasHelper(chat.page)
    const snapshot = `jsx-placement-${scenario}.png`
    try {
      await chat.submit('Render the proposed change')
      await expect.poll(() => stream.evaluate((s) => s.ready())).toBe(true)
      await stream.evaluate((s) => s.advance())
      await expect.poll(() => previewKey(chat.page)).not.toBe('')
      expect(await documentSnapshot(chat.page)).toEqual(before)
      await canvas.waitForRender()
      expect(await canvas.screenshotCanvasRegion(640, 400)).toMatchSnapshot(snapshot)
      await stream.evaluate((s) => s.complete())
      await expect(chat.assistantMessage()).toContainText('Rendered.')
      await expect.poll(() => previewKey(chat.page)).toBe('')
      await chat.page.evaluate(() => {
        const store = window.openPencil?.getStore?.()
        if (!store) throw new Error('Editor unavailable')
        store.clearSelection()
        for (const renderer of store.canvasRenderers) renderer.aiClearAll()
        store.requestRepaint()
      })
      await canvas.waitForRender()
      // Both speculative and authoritative output must match the same visual baseline.
      expect(await canvas.screenshotCanvasRegion(640, 400)).toMatchSnapshot(snapshot)
      await chat.page.evaluate(() => window.openPencil?.getStore?.().undoAction())
      expect(await documentSnapshot(chat.page)).toEqual(before)
    } finally {
      await stream.evaluate((s) => s.dispose())
      await stream.dispose()
    }
  })
}
