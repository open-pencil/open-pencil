import { expect, test, useEditorSetupWithClear } from '#tests/e2e/fixtures'
import { textStrokeSideDriver } from '#tests/helpers/canvas/text-stroke-sides/driver'

const editor = useEditorSetupWithClear('/?test&no-chrome&no-rulers')
const scenes = textStrokeSideDriver(() => editor.page)

test('saved text strokes keep to their side of the glyphs', async () => {
  await scenes.show()
  await editor.canvas.waitForRender()
  editor.canvas.assertNoErrors()
  const buffer = await editor.canvas.screenshotCanvasRegion()
  expect(buffer).toMatchSnapshot('saved-text-stroke-sides.png')
})
