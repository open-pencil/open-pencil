import { expect, test, useEditorSetupWithClear } from '#tests/e2e/fixtures'
import { pageScene } from '#tests/helpers/canvas/page-scene'
import type * as PatternScenes from '#tests/helpers/canvas/patterns/scene'

const editor = useEditorSetupWithClear('/?test&no-chrome&no-rulers')
const scenes = pageScene<typeof PatternScenes>(
  () => editor.page,
  '/tests/helpers/canvas/patterns/scene.ts'
)

test('tiles pattern sources built from children, strokes, or hidden fills', async () => {
  await scenes.build('createPatternFillScene')
  editor.canvas.assertNoErrors()
  expect(await editor.canvas.screenshotCanvasRegion(520, 200)).toMatchSnapshot('pattern-fills.png')
})
