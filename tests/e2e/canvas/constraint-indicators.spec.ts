import type { ConstraintType } from '@open-pencil/scene-graph'

import { expect, test, useEditorSetupWithClear } from '#tests/e2e/fixtures'
import { constraintIndicatorDriver } from '#tests/helpers/canvas/constraint-indicators/driver'

const editor = useEditorSetupWithClear('/?test&no-chrome&no-rulers')
const constrained = constraintIndicatorDriver(() => editor.page)

async function expectCanvas(name: string) {
  editor.canvas.assertNoErrors()
  const buffer = await editor.canvas.screenshotCanvasRegion()
  expect(buffer).toMatchSnapshot(`${name}.png`, { maxDiffPixelRatio: 0, threshold: 0 })
}

// A selected layer shows its constraints as dashed lines to its parent's edges (#1702).
for (const [name, horizontal, vertical] of [
  ['left-top', 'MIN', 'MIN'],
  ['right-bottom', 'MAX', 'MAX'],
  ['left-right-top-bottom', 'STRETCH', 'STRETCH'],
  ['center', 'CENTER', 'CENTER'],
  ['scale', 'SCALE', 'SCALE']
] as const satisfies readonly (readonly [string, ConstraintType, ConstraintType])[]) {
  test(`a selected layer pinned ${name} shows its constraint indicators`, async () => {
    await constrained.selectConstrainedLayer(horizontal, vertical)
    await editor.canvas.waitForRender()
    await expectCanvas(`constraints-${name}`)
  })
}

test('constraint indicators follow a rotated parent', async () => {
  await constrained.selectConstrainedLayer('MIN', 'MAX', 20)
  await editor.canvas.waitForRender()
  await expectCanvas('constraints-rotated-parent')
})

// A group owns no constraints: a layer in it pins to the frame, and the group shows the ones its
// layers share, from its own box, with nothing on an axis where they differ (live Figma, #1835).
test('a layer in a group shows its constraints to the frame', async () => {
  await constrained.selectInGroup('MIN', 'first')
  await editor.canvas.waitForRender()
  await expectCanvas('constraints-group-layer')
})

test('a group shows the constraints its layers share', async () => {
  await constrained.selectInGroup('MAX', 'group')
  await editor.canvas.waitForRender()
  await expectCanvas('constraints-group-shared')
})

test('a group whose layers differ shows none', async () => {
  await constrained.selectInGroup('MIN', 'group')
  await editor.canvas.waitForRender()
  await expectCanvas('constraints-group-mixed')
})
