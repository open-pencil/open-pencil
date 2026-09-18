import { expect, test, useEditorSetupWithClear } from '#tests/e2e/fixtures'
import { showImportedPageBackground } from '#tests/helpers/canvas/page-background'
import { readScenePixels } from '#tests/helpers/canvas/pixels'

const editor = useEditorSetupWithClear('/?test&no-chrome&no-rulers')

test('imported navy canvas background reaches the scene renderer', async () => {
  await showImportedPageBackground(editor.page)
  await editor.canvas.waitForRender()
  expect(await readScenePixels(editor.page, [{ x: 100, y: 100 }])).toEqual([[7, 35, 90, 255]])
  editor.canvas.assertNoErrors()
  expect(await editor.canvas.screenshotCanvasRegion()).toMatchSnapshot('imported-navy-page.png')
})
