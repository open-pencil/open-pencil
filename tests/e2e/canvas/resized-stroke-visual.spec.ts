import { expect, test, useEditorSetupWithClear } from '#tests/e2e/fixtures'
import { strokeSceneDriver } from '#tests/helpers/canvas/strokes/driver'

const editor = useEditorSetupWithClear('/?test&no-chrome&no-rulers')
const scene = strokeSceneDriver(() => editor.page, 'createResizedStrokeScene')

// Layout drops a saved outline and scales a vector path with the box. The geometry is checked in
// packages/core/tests/layout/auto-layout/vector-resize.test.ts and
// packages/core/tests/canvas/strokes/resized-inside-stroke.test.ts.
test('a resized inside stroke follows the frame and instance, and a vector path does too', async () => {
  await scene.show()
  await editor.canvas.waitForRender()
  editor.canvas.assertNoErrors()
  expect(await editor.canvas.screenshotCanvasRegion()).toMatchSnapshot('resized-strokes.png')
})
