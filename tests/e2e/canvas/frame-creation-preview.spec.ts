import type { Page } from '@playwright/test'

import { expect, test } from '#tests/e2e/fixtures'
import { expectDefined } from '#tests/helpers/assert'
import { CanvasHelper } from '#tests/helpers/canvas'

async function setup(page: Page, renderer: 'retained' | 'tiled') {
  await page.goto(`/?test&no-rulers&renderer=${renderer}&navigation-benchmark`)
  const canvas = new CanvasHelper(page)
  await canvas.waitForInit()
  await page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('Editor unavailable')
    for (let i = 0; i < 80; i++) {
      store.graph.createNode('TEXT', store.state.currentPageId, {
        x: 20 + (i % 8) * 100,
        y: 20 + Math.floor(i / 8) * 40,
        width: 96,
        height: 32,
        fontFamily: 'Inter',
        fontWeight: 400,
        fontSize: 12,
        text: `Swatch ${i}\nRegular text`
      })
    }
    store.clearSelection()
    store.requestRender()
  })
  await page.evaluate(() => window.openPencil?.test?.navigation?.waitForSettlement())
  const element = page.getByTestId('canvas-element')
  const box = expectDefined(await element.boundingBox(), 'canvas bounds')
  return {
    canvas,
    element,
    x: box.x + 80,
    y: box.y + 520,
    clip: { x: box.x + 140, y: box.y + 560, width: 24, height: 24 }
  }
}

async function probeCreation(page: Page) {
  return page.evaluateHandle(() => {
    const store = window.openPencil?.getStore?.()
    const element = document.querySelector('[data-test-id="canvas-element"]')
    if (!store || !element) throw new Error('Editor unavailable')
    const renderer = store.canvasRenderers.find((r) => r.tracksSceneSettlement)
    if (!renderer) throw new Error('Scene renderer unavailable')
    const backing = renderer.sceneBacking
    let committed = 0
    let pointerId: number | undefined
    const stop = store.onEditorEvent('node:updated', () => {
      committed++
    })
    const pointerDown = (event: Event) => {
      if (event instanceof PointerEvent) pointerId = event.pointerId
    }
    element.addEventListener('pointerdown', pointerDown)
    return {
      sample() {
        const node = store.getSelectedNodes()[0]
        return {
          id: node?.id,
          width: node?.width,
          height: node?.height,
          version: store.state.sceneVersion,
          committed,
          interactive: store.isInteractiveEditing(),
          hasBacking: backing !== null,
          sameBacking: renderer.sceneBacking === backing,
          batching: store.undo.isBatching
        }
      },
      cancelPointer() {
        if (pointerId === undefined) throw new Error('No captured pointer')
        element.dispatchEvent(
          new PointerEvent('pointercancel', { bubbles: true, pointerType: 'mouse', pointerId })
        )
      },
      dispose() {
        stop()
        element.removeEventListener('pointerdown', pointerDown)
      }
    }
  })
}

test.use({ viewport: { width: 1400, height: 1000 }, deviceScaleFactor: 2 })

for (const renderer of ['retained', 'tiled'] as const) {
  test(`${renderer}: Frame-tool creation previews without rebuilding the backing`, async ({
    page
  }) => {
    const { canvas, x, y, clip } = await setup(page, renderer)
    const before = await page.screenshot({ clip })
    const probe = await probeCreation(page)
    try {
      await page.keyboard.press('f')
      await page.mouse.move(x, y)
      await page.mouse.down()
      const started = await probe.evaluate((p) => p.sample())
      expect(started.interactive).toBe(true)
      expect(started.hasBacking).toBe(true)
      for (const delta of [60, 100, 140, 180, 220]) {
        await page.mouse.move(x + delta, y + 140)
        await canvas.waitForRender()
        const held = await probe.evaluate((p) => p.sample())
        expect(held.version).toBe(started.version)
        expect(held.committed).toBe(started.committed)
        expect(held.sameBacking).toBe(true)
      }
      expect((await page.screenshot({ clip })).equals(before)).toBe(false)
      await page.mouse.up()
      await page.evaluate(() => window.openPencil?.test?.navigation?.waitForSettlement())
      const finished = await probe.evaluate((p) => p.sample())
      expect(finished.interactive).toBe(false)
      expect(finished.batching).toBe(false)
      await page.evaluate(() => window.openPencil?.getStore?.().undoAction())
      expect(
        await page.evaluate(
          (id) => window.openPencil?.getStore?.().graph.getNode(id ?? '') === undefined,
          started.id
        )
      ).toBe(true)
      expect(await page.evaluate(() => window.openPencil?.getStore?.().undo.canUndo)).toBe(false)
      await page.evaluate(() => window.openPencil?.getStore?.().redoAction())
      const restored = await page.evaluate((id) => {
        const node = window.openPencil?.getStore?.().graph.getNode(id ?? '')
        return { width: node?.width, height: node?.height }
      }, started.id)
      expect(restored).toEqual({ width: finished.width, height: finished.height })
      canvas.assertNoErrors()
    } finally {
      await page.mouse.up()
      await probe.evaluate((p) => p.dispose())
      await probe.dispose()
    }
  })

  test(`${renderer}: Escape and pointer cancellation discard creation without leaking a batch`, async ({
    page
  }) => {
    const { canvas, x, y, clip } = await setup(page, renderer)
    const before = await page.screenshot({ clip })
    const probe = await probeCreation(page)
    try {
      for (const cancellation of ['escape', 'pointer'] as const) {
        await page.keyboard.press('f')
        await page.mouse.move(x, y)
        await page.mouse.down()
        await page.mouse.move(x + 220, y + 140)
        const { id } = await probe.evaluate((p) => p.sample())
        if (cancellation === 'escape') await page.keyboard.press('Escape')
        else await probe.evaluate((p) => p.cancelPointer())
        await page.mouse.up()
        await page.evaluate(() => window.openPencil?.test?.navigation?.waitForSettlement())
        expect(
          await page.evaluate(
            (nodeId) => window.openPencil?.getStore?.().graph.getNode(nodeId ?? '') === undefined,
            id
          )
        ).toBe(true)
        const cancelled = await probe.evaluate((p) => p.sample())
        expect(cancelled.interactive).toBe(false)
        expect(cancelled.batching).toBe(false)
        expect((await page.screenshot({ clip })).equals(before)).toBe(true)
      }
      canvas.assertNoErrors()
    } finally {
      await page.mouse.up()
      await probe.evaluate((p) => p.dispose())
      await probe.dispose()
    }
  })
}
