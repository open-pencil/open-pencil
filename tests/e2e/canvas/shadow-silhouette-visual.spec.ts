import { expect, test, useEditorSetupWithClear } from '#tests/e2e/fixtures'
import { shadowSilhouetteDriver } from '#tests/helpers/canvas/effects/driver'

const editor = useEditorSetupWithClear('/?test&no-chrome&no-rulers')
const scene = shadowSilhouetteDriver(() => editor.page)

// The silhouettes are checked against Figma's pixels in packages/core/tests/canvas/shadows.test.ts.
test('shadows are cast from what each layer draws, as in Figma', async () => {
  await scene.show()
  await editor.canvas.waitForRender()
  editor.canvas.assertNoErrors()
  expect(await editor.canvas.screenshotCanvasRegion()).toMatchSnapshot('shadow-silhouettes.png')
})
