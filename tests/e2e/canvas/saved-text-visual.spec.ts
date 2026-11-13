import { expect, test } from '#tests/e2e/fixtures'
import { CanvasHelper } from '#tests/helpers/canvas'
import { showView } from '#tests/helpers/canvas/page-scene'
import {
  createFallbackText,
  createWrappedText,
  readFallbackText,
  readWrappedTextLineCount,
  saveAsAndReopenWrappedText,
  saveCopyAndReopenFallbackText
} from '#tests/helpers/canvas/saved-text'
import { mockFontsource } from '#tests/helpers/fonts/fontsource'

const MESSAGE = 'A sentence long enough that it has to wrap onto a second line.'

test('wrapped text keeps its lines after a .fig is saved and reopened (#914)', async ({ page }) => {
  await page.goto('/?test&no-chrome&no-rulers')
  const canvas = new CanvasHelper(page)
  await canvas.waitForInit()
  await createWrappedText(page, MESSAGE)
  await saveAsAndReopenWrappedText(page)

  expect(await readWrappedTextLineCount(page)).toBe(2)
  await canvas.waitForRender()
  expect(await canvas.screenshotCanvasRegion()).toMatchSnapshot('reopened-wrapped-text.png')
})

const FALLBACK_STYLES = [
  { style: 'weight', italic: false, snapshot: 'fallback-file-after-reopen.png' },
  { style: 'weight and slant', italic: true, snapshot: 'fallback-italic-after-reopen.png' }
]

for (const { style, italic, snapshot } of FALLBACK_STYLES) {
  test(`fallback text with an unloaded primary keeps its ${style} after saving and reopening`, async ({
    page
  }) => {
    await mockFontsource(page, [])
    await page.goto('/?test&no-chrome&no-rulers')
    const canvas = new CanvasHelper(page)
    await canvas.waitForInit()
    const sampleId = await createFallbackText(page, { italic })
    await saveCopyAndReopenFallbackText(page)

    expect(await readFallbackText(page, sampleId)).toEqual({ text: 'Missing', glyphs: 7 })
    await showView(page, { zoom: 2, panX: 40, panY: 40 })
    await canvas.waitForRender()
    canvas.assertNoErrors()
    // Text fills too little of the canvas for the default percentage tolerance to catch bad outlines.
    expect(await canvas.screenshotCanvasRegion()).toMatchSnapshot(snapshot, { maxDiffPixels: 20 })
  })
}
