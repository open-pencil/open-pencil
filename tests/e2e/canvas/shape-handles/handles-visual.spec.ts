import { expect, test, useEditorSetupWithClear } from '#tests/e2e/fixtures'
import { shapeHandlesDriver } from '#tests/helpers/canvas/shape-handles-driver'

// Figma desktop: white handles ringed in the selection colour, at each arc's centre but at least
// 12.5 px inside the corner; a dot marks a drag of one corner, and the handle under the pointer
// shows its radius beside it.

const editor = useEditorSetupWithClear('/?test&no-chrome&no-rulers')

const corners = shapeHandlesDriver(() => editor.page)

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

test('a star under the pointer, its count handle hovered', async () => {
  await corners.show({ pointCount: 5, starInnerRadius: 0.38, cornerRadius: 8 }, 'STAR')
  const centre = corners.point(80, 90)
  await editor.canvas.hover(centre.x, centre.y)
  // The middle of the rounded point to the right of the top one, where its count handle sits.
  const count = corners.point(139, 61)
  await editor.canvas.hover(count.x, count.y)
  expect(await editor.canvas.screenshotCanvasRegion(360, 360)).toMatchSnapshot('star.png')
  editor.canvas.assertNoErrors()
})
