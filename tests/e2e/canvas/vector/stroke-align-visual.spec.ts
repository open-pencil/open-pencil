import { expect, test, useEditorSetupWithClear } from '#tests/e2e/fixtures'
import { strokeSceneDriver } from '#tests/helpers/canvas/strokes/driver'

const editor = useEditorSetupWithClear('/?test&no-chrome&no-rulers')
const scene = strokeSceneDriver(() => editor.page, 'createVectorStrokeAlignScene')
const regions = strokeSceneDriver(() => editor.page, 'createVectorRegionsScene')

// Figma 126 strokes inside or outside a path as a centred stroke twice as wide, clipped; the pixels
// are checked in packages/core/tests/canvas/strokes/vector-align.test.ts.
test('a vector drawn from its path strokes on the side its alignment takes', async () => {
  await scene.show()
  await editor.canvas.waitForRender()
  editor.canvas.assertNoErrors()
  expect(await editor.canvas.screenshotCanvasRegion()).toMatchSnapshot('vector-stroke-align.png')
})

test('a vector with several regions strokes and shadows them as one shape', async () => {
  await regions.show()
  await editor.canvas.waitForRender()
  editor.canvas.assertNoErrors()
  expect(await editor.canvas.screenshotCanvasRegion()).toMatchSnapshot('vector-regions.png')
})
