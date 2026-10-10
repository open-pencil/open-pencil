import { expect, test, useEditorSetupWithClear } from '#tests/e2e/fixtures'
import { cornerRadiusDriver } from '#tests/helpers/canvas/corner-radius-driver'

// Figma desktop: a selected rectangle under the pointer shows a handle inside each corner.
// Dragging one sets the radius whose arc centre is under the pointer, on every corner while they
// are equal and on that corner alone while they differ; Alt swaps the two.

const editor = useEditorSetupWithClear('/?test&no-rulers')

const corners = cornerRadiusDriver(() => editor.page)

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
