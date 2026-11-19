import { expect, test, useEditorSetupWithClear } from '#tests/e2e/fixtures'
import { grainEffectsDriver } from '#tests/helpers/canvas/effects/driver'

const editor = useEditorSetupWithClear('/?test&no-chrome&no-rulers')
const scene = grainEffectsDriver(() => editor.page)

// The grain's statistics are checked against Figma's exports in packages/core/tests/canvas/noise.
test('noise and texture effects draw their grain', async () => {
  await scene.show()
  await editor.canvas.waitForRender()
  editor.canvas.assertNoErrors()
  expect(await editor.canvas.screenshotCanvasRegion()).toMatchSnapshot('grain-effects.png')
})
