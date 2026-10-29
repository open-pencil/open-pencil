import { expect, test, useEditorSetupWithClear } from '#tests/e2e/fixtures'
import { strokeSceneDriver } from '#tests/helpers/canvas/strokes/driver'

const editor = useEditorSetupWithClear('/?test&no-chrome&no-rulers')
const scene = strokeSceneDriver(() => editor.page, 'createDashedContainersScene')

// The dash layout is checked against Figma in packages/core/tests/canvas/strokes/sides.test.ts.
test('sections and component sets dash their strokes as rectangles do', async () => {
  await scene.show()
  await editor.canvas.waitForRender()
  editor.canvas.assertNoErrors()
  expect(await editor.canvas.screenshotCanvasRegion()).toMatchSnapshot('dashed-containers.png', {
    threshold: 0.05
  })
})
