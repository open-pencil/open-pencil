import { expect, test } from '#tests/e2e/fixtures'
import { CanvasHelper } from '#tests/helpers/canvas'

for (const suppressed of [false, true]) {
  test(`ruler menu changes rendered visibility with no-rulers=${suppressed}`, async ({ page }) => {
    await page.goto(suppressed ? '/?test&no-rulers' : '/?test')
    const canvas = new CanvasHelper(page)
    await canvas.waitForInit()
    await page.mouse.move(0, 0)
    const initial = await canvas.screenshotCanvasRegion()

    async function toggleRulers() {
      await page.getByRole('button', { name: '100%', exact: true }).click()
      await page.getByRole('menuitem', { name: /^Rulers(?:\s|$)/ }).click()
      await page.keyboard.press('Escape')
      await page.mouse.move(0, 0)
      await canvas.waitForRender()
    }

    await toggleRulers()
    const hidden = await canvas.screenshotCanvasRegion()
    expect(hidden.equals(initial)).toBe(suppressed)
    await toggleRulers()
    expect((await canvas.screenshotCanvasRegion()).equals(initial)).toBe(true)
    canvas.assertNoErrors()
  })
}
