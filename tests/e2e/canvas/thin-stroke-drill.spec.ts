import { expect, test, useEditorSetupWithClear } from '#tests/e2e/fixtures'
import { clickDepthDriver } from '#tests/helpers/canvas/click-depth/driver'

// Measured in Figma desktop 126 on the shadcn kit's line chart: from the selected component,
// double-clicks on its curve go one level each, to the group and then the curve, at any zoom.
// Zoomed out, the curve's 2-unit stroke is under a pixel wide, so the click is taken within a few
// screen pixels of it, as a press is.

const editor = useEditorSetupWithClear('/?test&no-chrome&no-rulers')

const scene = clickDepthDriver(() => editor.page)

test('double-clicks drill to a thin unfilled curve in a component when zoomed out', async () => {
  const { component, group, curve } = await scene.componentChart()
  await scene.zoomTo(0.44)
  await editor.canvas.waitForRender()
  // On the curve's apex, 2 screen pixels below its centre line: 4.5 units at 44%.
  const apex = await scene.at(component, 20 + 150, 60 + 0)
  const point = { x: apex.x, y: apex.y + 2 }

  await editor.canvas.click(point.x, point.y)
  await expect.poll(async () => (await scene.state()).selected).toEqual([component])

  await editor.canvas.dblclick(point.x, point.y)
  await expect.poll(async () => (await scene.state()).selected).toEqual([group])

  await editor.canvas.dblclick(point.x, point.y)
  await expect.poll(async () => (await scene.state()).selected).toEqual([curve])
  editor.canvas.assertNoErrors()
})
