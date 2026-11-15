import { expect, test, useEditorSetupWithClear } from '#tests/e2e/fixtures'
import { textOverflowDriver } from '#tests/helpers/canvas/text-overflow-driver'

const editor = useEditorSetupWithClear('/?test&no-chrome&no-rulers')
const texts = textOverflowDriver(() => editor.page)

// Figma 126 never clips a text layer to its box: a fixed-size box grown past by its text draws
// the rest below it, and only a frame that clips its content cuts the text off.
test('draws a fixed-size text past its box, and a clipping frame still cuts it', async () => {
  for (const { height, linesHeight } of await texts.show()) {
    expect(height).toBe(40)
    expect(linesHeight).toBeGreaterThan(100)
  }
  await editor.canvas.waitForRender()
  editor.canvas.assertNoErrors()
  expect(await editor.canvas.screenshotCanvasRegion()).toMatchSnapshot('text-overflow.png')
})

// Figma's saved layouts put a centred text's overflow half above and half below its box, and a
// bottom-aligned one's all above; a clipping frame cuts what reaches past its top.
for (const align of ['CENTER', 'BOTTOM'] as const) {
  test(`draws a ${align.toLowerCase()}-aligned text's overflow above its box too`, async () => {
    for (const { height, linesHeight } of await texts.show(align, 220)) {
      expect(height).toBe(40)
      expect(linesHeight).toBeGreaterThan(100)
    }
    await editor.canvas.waitForRender()
    editor.canvas.assertNoErrors()
    expect(await editor.canvas.screenshotCanvasRegion()).toMatchSnapshot(
      `text-overflow-${align.toLowerCase()}.png`
    )
  })
}
