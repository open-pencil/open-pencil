import type { Page } from '@playwright/test'

import { expect, test } from '#tests/e2e/fixtures'
import { expectDefined } from '#tests/helpers/assert'
import { CanvasHelper } from '#tests/helpers/canvas'
import { propertyField } from '#tests/helpers/properties'

test.use({ viewport: { width: 1400, height: 900 }, deviceScaleFactor: 1 })

async function settle(page: Page) {
  await page.evaluate(async () => {
    const hooks = window.openPencil?.test?.navigation
    if (!hooks) throw new Error('Navigation hooks unavailable')
    await hooks.waitForSettlement()
  })
}

async function takeRecording(page: Page) {
  return page.evaluate(() => {
    const hooks = window.openPencil?.test?.navigation
    if (!hooks) throw new Error('Navigation hooks unavailable')
    const recording = hooks.stopRecording()
    hooks.startRecording('next-phase')
    return recording
  })
}

function expectTiledSubmission(
  proof: Awaited<ReturnType<typeof takeRecording>>,
  generation?: number
) {
  expect(proof.sceneRenderer).toBe('tiled')
  expect(
    proof.trace.some(
      ({ detail }) =>
        detail.layer === 'tiled-scheduler' &&
        (generation === undefined || detail.sceneVersion === generation) &&
        typeof detail.presentedTileCount === 'number' &&
        detail.presentedTileCount > 0 &&
        detail.remaining === 0
    )
  ).toBe(true)
}

async function sceneVersion(page: Page) {
  return page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('Editor unavailable')
    return store.state.sceneVersion
  })
}

async function crop(page: Page) {
  const box = expectDefined(await page.getByTestId('canvas-element').boundingBox(), 'canvas bounds')
  return page.screenshot({ clip: { x: box.x + 24, y: box.y + 24, width: 360, height: 200 } })
}

async function directReference(page: Page) {
  const probe = await page.evaluateHandle(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('Editor unavailable')
    const renderer = store.canvasRenderers.find((r) => r.tracksSceneSettlement)
    if (!renderer) throw new Error('Scene renderer unavailable')
    renderer.invalidateAllPictures()
    const end = store.beginInteractiveEdit()
    return { end }
  })
  try {
    await new CanvasHelper(page).waitForRender()
    return await crop(page)
  } finally {
    await probe.evaluate((p) => p.end())
    await probe.dispose()
    await settle(page)
  }
}

test.beforeEach(async ({ page }) => {
  await page.goto('/?test&no-rulers&renderer=tiled&navigation-benchmark')
  await new CanvasHelper(page).waitForInit()
  await page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    const hooks = window.openPencil?.test?.navigation
    if (!store || !hooks) throw new Error('Editor unavailable')
    hooks.startRecording('tiled-property-preview')
    store.setZoomAroundPoint(1, 0, 0)
    store.pan(-store.state.panX, -store.state.panY)
    const frame = store.createShape('FRAME', 40, 40, 240, 120)
    store.graph.createNode('TEXT', frame, {
      name: 'Preview text',
      x: 20,
      y: 30,
      width: 160,
      height: 40,
      text: 'Prepared text',
      fontFamily: 'Inter',
      fontWeight: 400,
      fontSize: 20,
      fills: [{ type: 'SOLID', color: { r: 0, g: 0, b: 0, a: 1 }, opacity: 1, visible: true }]
    })
    store.select([frame])
  })
  await settle(page)
})

test.afterEach(async ({ page }) => {
  await page.evaluate(() => window.openPencil?.test?.navigation?.stopRecording())
})

for (const [property, label] of [
  ['x', 'X Axis'],
  ['width', 'Width']
] as const) {
  test(`tiled ${property} scrubbing commits and cancels without stale pixels`, async ({ page }) => {
    const canvas = new CanvasHelper(page)
    const field = propertyField(page, property)
    const before = Number(await field.getAttribute('aria-valuenow'))
    const version = await sceneVersion(page)
    const box = expectDefined(await field.boundingBox(), 'numeric field')
    const x = box.x + box.width / 2
    const y = box.y + box.height / 2
    await page.mouse.move(x, y)
    await page.mouse.down()
    try {
      await page.mouse.move(x + 24, y, { steps: 4 })
      await expect(field).not.toHaveAttribute('aria-valuenow', String(before))
      expect(await sceneVersion(page)).toBe(version)
      expect(
        await page.evaluate(() => window.openPencil?.getStore?.().isInteractiveEditing())
      ).toBe(true)
    } finally {
      await page.mouse.up()
    }
    await settle(page)
    const committed = Number(await field.getAttribute('aria-valuenow'))
    const committedVersion = await sceneVersion(page)
    const committedPixels = await crop(page)
    expectTiledSubmission(await takeRecording(page), committedVersion)
    expect(committedPixels.equals(await directReference(page))).toBe(true)

    await field.click()
    const input = field.getByRole('spinbutton', { name: label })
    await input.fill(String(committed + 50))
    await canvas.waitForRender()
    expect((await crop(page)).equals(committedPixels)).toBe(false)
    await input.press('Escape')
    await expect(field).toHaveAttribute('aria-valuenow', String(committed))
    await settle(page)
    expect((await crop(page)).equals(committedPixels)).toBe(true)
    const cancelledVersion = await sceneVersion(page)
    expect(await page.evaluate(() => window.openPencil?.getStore?.().isInteractiveEditing())).toBe(
      false
    )

    expectTiledSubmission(await takeRecording(page), cancelledVersion)
    canvas.assertNoErrors()
  })
}

test('font arrival invalidates tiled text and matches a fresh direct render', async ({ page }) => {
  const requested = Promise.withResolvers<undefined>()
  const release = Promise.withResolvers<undefined>()
  await page.route('**/Inter-Bold.ttf', async (route) => {
    requested.resolve(undefined)
    await release.promise
    await route.continue()
  })
  try {
    await page.evaluate(() => {
      const store = window.openPencil?.getStore?.()
      if (!store) throw new Error('Editor unavailable')
      const frame = store.getSelectedNodes()[0]
      const textId = frame?.childIds[0]
      if (!textId) throw new Error('Text fixture missing')
      store.updateNode(textId, { fontWeight: 700 })
    })
    await requested.promise
    await settle(page)
    const waiting = await crop(page)
    await takeRecording(page)
    release.resolve(undefined)
    await expect
      .poll(async () => {
        await settle(page)
        return (await crop(page)).equals(waiting)
      })
      .toBe(false)
    const tiled = await crop(page)
    expectTiledSubmission(await takeRecording(page))
    expect(tiled.equals(await directReference(page))).toBe(true)
  } finally {
    release.resolve(undefined)
    await page.unroute('**/Inter-Bold.ttf')
  }
})
