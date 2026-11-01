import { expect, test, useEditorSetupWithClear } from '#tests/e2e/fixtures'
import { linearBlendDriver } from '#tests/helpers/canvas/blend/driver'

const editor = useEditorSetupWithClear('/?test&no-chrome&no-rulers')
const scene = linearBlendDriver(() => editor.page)

test('plus darker and plus lighter on layers, fills and strokes', async () => {
  await scene.show()
  await editor.canvas.waitForRender()
  editor.canvas.assertNoErrors()
  expect(await editor.canvas.screenshotCanvasRegion()).toMatchSnapshot(
    'plus-darker-plus-lighter.png'
  )
})
