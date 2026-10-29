import { expect, test, useEditorSetupWithClear } from '#tests/e2e/fixtures'
import { strokeSceneDriver } from '#tests/helpers/canvas/strokes/driver'

const editor = useEditorSetupWithClear('/?test&no-chrome&no-rulers')
const scene = strokeSceneDriver(() => editor.page, 'createDashEndsScene')

// The caps, joins, and smoothed corners are checked against Figma in
// packages/core/tests/canvas/strokes/outlined-dashes.test.ts.
test('dash ends, joins, and smoothed corners', async () => {
  await scene.show()
  await editor.canvas.waitForRender()
  editor.canvas.assertNoErrors()
  expect(await editor.canvas.screenshotCanvasRegion()).toMatchSnapshot('dash-ends.png', {
    threshold: 0.05
  })
})
