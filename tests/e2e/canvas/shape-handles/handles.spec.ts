import { expect, test, useEditorSetupWithClear } from '#tests/e2e/fixtures'
import { shapeHandlesDriver } from '#tests/helpers/canvas/shape-handles-driver'

// Figma desktop: a selected rectangle under the pointer shows a handle inside each corner.
// Dragging one sets the radius whose arc centre is under the pointer, on every corner while they
// are equal and on that corner alone while they differ; Alt swaps the two.

const editor = useEditorSetupWithClear('/?test&no-rulers')

const corners = shapeHandlesDriver(() => editor.page)

/**
 * Drags the top-left handle, which sits `inset` px inside the corner, to (at, at) of the rectangle.
 */
async function dragTopLeft(inset: number, at: number, modifier?: 'Alt' | 'Shift') {
  const from = corners.point(inset, inset)
  const to = corners.point(at, at)
  if (modifier) await editor.page.keyboard.down(modifier)
  await editor.canvas.drag(from.x, from.y, to.x, to.y)
  if (modifier) await editor.page.keyboard.up(modifier)
  await editor.canvas.waitForRender()
}

test('dragging a handle rounds every corner, in one undo step', async () => {
  const nodeId = await corners.show()
  await dragTopLeft(12, 40)
  expect(await corners.radii(nodeId)).toEqual([40, 40, 40, 40])

  await editor.canvas.undo()
  expect(await corners.radii(nodeId)).toEqual([0, 0, 0, 0])
  editor.canvas.assertNoErrors()
})

test('Alt rounds only the dragged corner, and Shift rounds to tens', async () => {
  const nodeId = await corners.show()
  await dragTopLeft(12, 40, 'Alt')
  expect(await corners.radii(nodeId)).toEqual([40, 0, 0, 0])

  await dragTopLeft(40, 33, 'Shift')
  expect(await corners.radii(nodeId)).toEqual([30, 0, 0, 0])
})

test('differing corners drag alone, and Alt sets them all', async () => {
  const nodeId = await corners.show({
    independentCorners: true,
    topLeftRadius: 0,
    topRightRadius: 40,
    bottomRightRadius: 0,
    bottomLeftRadius: 20
  })
  await dragTopLeft(12, 24)
  expect(await corners.radii(nodeId)).toEqual([24, 40, 0, 20])

  await dragTopLeft(24, 50, 'Alt')
  expect(await corners.radii(nodeId)).toEqual([50, 50, 50, 50])
})

// Figma desktop: a polygon or star has one handle, below its top point, and its corners share
// the radius the handle sets, up to what fits along its edges.
test('a polygon rounds every corner from the handle below its top point', async () => {
  const nodeId = await corners.show({ pointCount: 3 }, 'POLYGON')
  const from = corners.point(80, 18)
  const to = corners.point(80, 48)
  await editor.canvas.drag(from.x, from.y, to.x, to.y)
  await editor.canvas.waitForRender()
  expect(await corners.radii(nodeId)).toEqual([24, 24, 24, 24])

  const far = corners.point(80, 400)
  await editor.canvas.drag(to.x, to.y, far.x, far.y)
  await editor.canvas.waitForRender()
  expect((await corners.radii(nodeId))?.[0]).toBeCloseTo(40, 6)
})

// Figma desktop: a star's next outer point sets its point count from the angle around its centre,
// and its first inner point its inner ratio from the distance to the centre.
test('a star changes its point count and ratio from the handles on its points', async () => {
  const nodeId = await corners.show({ pointCount: 5, starInnerRadius: 0.38 }, 'STAR')
  const angle = (degrees: number, distance: number) =>
    corners.point(
      80 + distance * Math.sin((degrees * Math.PI) / 180),
      80 - distance * Math.cos((degrees * Math.PI) / 180)
    )
  const count = angle(72, 80)
  const to = angle(30, 80)
  await editor.canvas.drag(count.x, count.y, to.x, to.y)
  await editor.canvas.waitForRender()
  expect((await corners.points(nodeId))?.count).toBe(12)

  const ratio = angle(15, 80 * 0.38)
  const out = angle(15, 40)
  await editor.canvas.drag(ratio.x, ratio.y, out.x, out.y)
  await editor.canvas.waitForRender()
  expect((await corners.points(nodeId))?.ratio).toBe(0.5)
})
