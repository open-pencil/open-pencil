import { expect, test, useEditorSetupWithClear } from '#tests/e2e/fixtures'
import { strokeSceneDriver } from '#tests/helpers/canvas/strokes/driver'

const editor = useEditorSetupWithClear('/?test&no-chrome&no-rulers')
const scene = strokeSceneDriver(() => editor.page, 'createSideStrokesScene')

// The ring, corner radii, and dashes are checked against Figma in packages/core/tests/canvas/strokes/sides.test.ts.
test('strokes with sides of their own weights', async () => {
  await scene.show()
  await editor.canvas.waitForRender()
  editor.canvas.assertNoErrors()
  // The corners are small next to the canvas: pin an absolute pixel budget below one corner,
  // and a colour threshold under the gap between a translucent stroke and the canvas.
  expect(await editor.canvas.screenshotCanvasRegion()).toMatchSnapshot('side-strokes.png', {
    maxDiffPixels: 24,
    threshold: 0.05
  })
})
