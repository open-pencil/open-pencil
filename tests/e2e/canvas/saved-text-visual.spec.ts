import { expect, test } from '#tests/e2e/fixtures'
import { CanvasHelper } from '#tests/helpers/canvas'
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

test('fallback text with an unloaded primary keeps its weight after saving and reopening', async ({
  page
}) => {
  await mockFontsource(page, [])
  await page.goto('/?test&no-chrome&no-rulers')
  const canvas = new CanvasHelper(page)
  await canvas.waitForInit()
  const sampleId = await createFallbackText(page)
  await saveCopyAndReopenFallbackText(page)

  expect(await readFallbackText(page, sampleId)).toEqual({ text: 'Missing', glyphs: 7 })
  await canvas.waitForRender()
  canvas.assertNoErrors()
  // Text fills too little of the canvas for the default percentage tolerance to catch bad outlines.
  expect(await canvas.screenshotCanvasRegion()).toMatchSnapshot('fallback-file-after-reopen.png', {
    maxDiffPixels: 20
  })
})
