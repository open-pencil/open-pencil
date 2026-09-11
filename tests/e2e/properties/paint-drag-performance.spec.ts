import { expect, test } from '@playwright/test'

import { CanvasHelper } from '#tests/helpers/canvas'

test('large component color drag stays bounded', async ({ page }) => {
  test.setTimeout(60_000)
  await page.route('**/shadcn-performance.fig', async (route) =>
    route.fulfill({ path: '/tmp/shadcn-performance.fig', contentType: 'application/octet-stream' })
  )
  await page.goto('/?test')
  const canvas = new CanvasHelper(page)
  await canvas.waitForInit()
  await page.evaluate(() => window.openPencil?.openFile?.('/shadcn-performance.fig'))
  await page.waitForFunction(() => (window.openPencil?.getStore?.().graph.nodes.size ?? 0) > 1000)
  await page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('Editor unavailable')
    const target =
      [...store.graph.nodes.values()].find(
        (node) => node.type === 'COMPONENT' && node.fills[0]?.type === 'SOLID'
      ) ?? [...store.graph.nodes.values()].find((node) => node.fills[0]?.type === 'SOLID')
    if (!target) throw new Error('No solid fill target')
    store.select([target.id])
  })
  await page.getByTestId('fill-picker-swatch').first().click()
  const area = page.locator('[data-picker-content]').locator('[role="slider"]').first()
  const box = await area.boundingBox()
  if (!box) throw new Error('Missing color control')
  const started = performance.now()
  await page.mouse.move(box.x + 2, box.y + box.height / 2)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width - 2, box.y + box.height / 2, { steps: 60 })
  await page.mouse.up()
  const elapsed = performance.now() - started
  expect(elapsed).toBeLessThan(1500)
  canvas.assertNoErrors()
})
