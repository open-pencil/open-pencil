import { expect, test } from '#tests/e2e/fixtures'
import { CanvasHelper } from '#tests/helpers/canvas'
import { flippedSubtreesDriver } from '#tests/helpers/canvas/flipped-subtrees-driver'

test.use({ viewport: { width: 1400, height: 900 }, deviceScaleFactor: 1 })

test('tiles draw flipped subtrees as a direct render does', async ({ page }) => {
  const canvas = new CanvasHelper(page)
  const scene = flippedSubtreesDriver(() => page)
  await page.goto('/?test&no-chrome&no-rulers&navigation-benchmark')
  await canvas.waitForInit()
  await scene.show()

  const { pixels, submission } = await scene.tiled()
  expect(submission.sceneRenderer).toBe('tiled')
  expect(submission.presentedTiles).toBeGreaterThan(0)
  expect(await scene.differentPixels(pixels, await scene.direct())).toBe(0)
  expect(pixels).toMatchSnapshot('flipped-subtrees.png')
  canvas.assertNoErrors()
})
