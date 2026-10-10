import { expect, test, useEditorSetupWithClear } from '#tests/e2e/fixtures'
import { blurEffectsDriver } from '#tests/helpers/canvas/effects/driver'

const editor = useEditorSetupWithClear('/?test&no-chrome&no-rulers')
const scene = blurEffectsDriver(() => editor.page)

// The falloff itself is checked against Figma's pixels in packages/core/tests/canvas/blur.test.ts.
test('blur effects draw with Figma’s falloff', async () => {
  await scene.show()
  await editor.canvas.waitForRender()
  editor.canvas.assertNoErrors()
  expect(await editor.canvas.screenshotCanvasRegion()).toMatchSnapshot('blur-effects.png')
})
