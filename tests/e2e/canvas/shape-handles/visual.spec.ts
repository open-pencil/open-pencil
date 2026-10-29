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

// Figma desktop: an arc's start handle carries a dot, its end handle and the ratio handle on the
// inner edge mid-sweep are plain, and the dragged handle's label shows the sweep in percent.
test('a ring arc, its end handle hovered', async () => {
  await corners.show(
    { arcData: { startingAngle: Math.PI / 4, endingAngle: Math.PI * 1.75, innerRadius: 0.4 } },
    'ELLIPSE'
  )
  const centre = corners.point(80, 140)
  await editor.canvas.hover(centre.x, centre.y)
  const angle = Math.PI * 1.75
  const end = corners.point(80 + 56 * Math.cos(angle), 80 + 56 * Math.sin(angle))
  await editor.canvas.hover(end.x, end.y)
  expect(await editor.canvas.screenshotCanvasRegion(360, 360)).toMatchSnapshot('arc.png')
  editor.canvas.assertNoErrors()
})

// Figma desktop: a pie's edges run straight to the centre, where its ratio handle sits.
test('a pie, its start handle hovered', async () => {
  await corners.show(
    { arcData: { startingAngle: 0, endingAngle: Math.PI * 1.5, innerRadius: 0 } },
    'ELLIPSE'
  )
  const inside = corners.point(60, 120)
  await editor.canvas.hover(inside.x, inside.y)
  const start = corners.point(120, 80)
  await editor.canvas.hover(start.x, start.y)
  expect(await editor.canvas.screenshotCanvasRegion(360, 360)).toMatchSnapshot('pie.png')
  editor.canvas.assertNoErrors()
})
