import { expect, test, useEditorSetupWithClear } from '#tests/e2e/fixtures'
import { textAutoWidthDriver } from '#tests/helpers/canvas/text-auto-width/driver'

const editor = useEditorSetupWithClear('/?test&no-chrome&no-rulers')
const autoWidth = textAutoWidthDriver(() => editor.page)

test('truncates text that sizes its own width at its max width', async () => {
  await autoWidth.show()
  await editor.canvas.waitForRender()
  editor.canvas.assertNoErrors()
  expect(await editor.canvas.screenshotCanvasRegion(320, 260)).toMatchSnapshot(
    'text-auto-width.png'
  )
})
