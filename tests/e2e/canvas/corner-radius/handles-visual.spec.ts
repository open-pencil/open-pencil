import { expect, test, useEditorSetupWithClear } from '#tests/e2e/fixtures'
import { cornerRadiusDriver } from '#tests/helpers/canvas/corner-radius-driver'

// Figma desktop: white handles ringed in the selection colour, at each arc's centre but at least
// 12.5 px inside the corner; a dot marks a drag of one corner, and the handle under the pointer
// shows its radius beside it.

const editor = useEditorSetupWithClear('/?test&no-chrome&no-rulers')

const corners = cornerRadiusDriver(() => editor.page)

test('equal corners', async () => {
  await corners.show({ cornerRadius: 20 })
  const centre = corners.point(80, 116)
  await editor.canvas.hover(centre.x, centre.y)
  expect(await editor.canvas.screenshotCanvasRegion(360, 440)).toMatchSnapshot('equal.png')
  editor.canvas.assertNoErrors()
})

test('differing corners, the top-right one hovered', async () => {
  await corners.show({
    independentCorners: true,
    topLeftRadius: 10,
    topRightRadius: 40,
    bottomRightRadius: 0,
    bottomLeftRadius: 20
  })
  const handle = corners.point(120, 40)
  await editor.canvas.hover(handle.x, handle.y)
  expect(await editor.canvas.screenshotCanvasRegion(360, 440)).toMatchSnapshot('differing.png')
  editor.canvas.assertNoErrors()
})
