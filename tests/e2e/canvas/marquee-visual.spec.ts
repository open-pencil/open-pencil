import type { Page } from '@playwright/test'

import { expect, test, useEditorSetupWithClear } from '#tests/e2e/fixtures'
import type * as MarqueeScenes from '#tests/helpers/canvas/marquee/scene'
import { pageScene, showView } from '#tests/helpers/canvas/page-scene'
import { getSelectedIds } from '#tests/helpers/store'

const editor = useEditorSetupWithClear('/?test&no-chrome&no-rulers')
const scenes = (page: () => Page) =>
  pageScene<typeof MarqueeScenes>(page, '/tests/helpers/canvas/marquee/scene.ts')

// Figma strokes the marquee one screen pixel wide at every zoom. At 5% a single caught layer
// leaves its 1/zoom world outline width on the shared selection paint, which drew the marquee's
// border as a 20 px band.
test('the marquee border stays one pixel wide at 5% zoom', async () => {
  const { page, canvas } = editor

  await scenes(() => page).build('createMarqueeScene')
  await showView(page, { zoom: 0.05, panX: 0, panY: 0 })
  await canvas.waitForRender()

  // The marquee exists only while the pointer is down, so the drag is held open for the capture.
  const box = await page.getByTestId('canvas-element').boundingBox()
  if (!box) throw new Error('No canvas')
  await page.mouse.move(box.x + 60, box.y + 60)
  await page.mouse.down()
  await page.mouse.move(box.x + 450, box.y + 350, { steps: 10 })
  await canvas.waitForRender()

  expect(await getSelectedIds(page), 'the marquee catches one layer').toBe(1)

  // The marquee's top-left corner against the page, short of the caught layer and its handles.
  expect(await canvas.screenshotCanvasRegion(95, 130)).toMatchSnapshot('marquee-border.png', {
    maxDiffPixelRatio: 0,
    threshold: 0
  })

  await page.mouse.up()
  await canvas.waitForRender()
  canvas.assertNoErrors()
})
