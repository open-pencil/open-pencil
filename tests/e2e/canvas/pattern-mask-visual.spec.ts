import { expect, test, useEditorSetupWithClear } from '#tests/e2e/fixtures'
import { maskSceneDriver } from '#tests/helpers/canvas/masks/driver'

const editor = useEditorSetupWithClear('/?test&no-chrome&no-rulers')
const scenes = maskSceneDriver(() => editor.page)

async function expectCanvas(name: string) {
  await editor.canvas.waitForRender()
  editor.canvas.assertNoErrors()
  const buffer = await editor.canvas.screenshotCanvasRegion()
  expect(buffer).toMatchSnapshot(`${name}.png`)
}

test('pattern fills from source nodes', async () => {
  await scenes.show('pattern-fills')
  await expectCanvas('pattern-fills-from-source-nodes')
})

test('luminance masks and transformed tile fills', async () => {
  await scenes.show('luminance-masks')
  await expectCanvas('luminance-masks-and-transformed-tile-fills')
})

test('a mask applies its opacity and blur to what it masks', async () => {
  await scenes.show('mask-effects')
  await expectCanvas('mask-opacity-and-blur')
})
