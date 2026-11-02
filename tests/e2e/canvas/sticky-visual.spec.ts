import { expect, test, useEditorSetupWithClear } from '#tests/e2e/fixtures'
import { stickyDriver } from '#tests/helpers/canvas/sticky-driver'

const editor = useEditorSetupWithClear('/?test&no-chrome&no-rulers')
const sticky = stickyDriver(() => editor.page)

test('sticky notes draw their colour, shadows, body, author, and the empty placeholder', async () => {
  await sticky.add([
    { x: 160, y: 160, author: 'Ada Lovelace' },
    { x: 440, y: 160, text: 'Ship sticky notes\nwith connectors next', author: 'Ada Lovelace' },
    {
      x: 720,
      y: 160,
      text: 'No author here',
      color: { r: 1, g: 226 / 255, b: 153 / 255, a: 1 },
      authorVisible: false
    }
  ])
  await editor.canvas.waitForRender()
  editor.canvas.assertNoErrors()
  expect(await editor.canvas.screenshotCanvasRegion()).toMatchSnapshot('sticky-notes.png')
})
