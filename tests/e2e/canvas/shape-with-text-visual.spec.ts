import { expect, test, useEditorSetupWithClear } from '#tests/e2e/fixtures'
import {
  shapeWithTextDriver,
  type ShapeWithTextSetup
} from '#tests/helpers/canvas/shape-with-text-driver'

const editor = useEditorSetupWithClear('/?test&no-chrome&no-rulers')
const shapes = shapeWithTextDriver(() => editor.page)

const KINDS = [
  ['SQUARE', 'Process'],
  ['DIAMOND', 'Paid?'],
  ['ENG_DATABASE', 'Orders'],
  ['DOCUMENT_MULTIPLE', 'Invoices'],
  ['ELLIPSE', 'Start'],
  ['PARALLELOGRAM_RIGHT', 'Read input'],
  ['ARROW_RIGHT', 'Next'],
  ['SPEECH_BUBBLE', 'Hello']
] as const

test('shapes with text draw their kind with the label inside', async () => {
  await shapes.place(
    KINDS.map(([kind, label], index): ShapeWithTextSetup => ({
      kind,
      label,
      x: 40 + (index % 4) * 170,
      y: 40 + Math.floor(index / 4) * 140,
      width: 150,
      height: 110,
      fill: [0.86, 0.92, 1],
      stroke: [0.1, 0.12, 0.2],
      labelColor: [0.75, 0.1, 0.1]
    }))
  )
  await editor.canvas.waitForRender()
  editor.canvas.assertNoErrors()
  expect(await editor.canvas.screenshotCanvasRegion()).toMatchSnapshot('shapes-with-text.png')
})

const STROKED = ['ELLIPSE', 'ROUNDED_RECTANGLE', 'SHIELD', 'ENG_DATABASE'] as const

test('inside and outside strokes follow the outline, and inner lines keep their weight', async () => {
  await shapes.place(
    (['INSIDE', 'OUTSIDE'] as const).flatMap((strokeAlign, row) =>
      STROKED.map((kind, index): ShapeWithTextSetup => ({
        kind,
        label: '',
        x: 40 + index * 170,
        y: 40 + row * 170,
        width: 130,
        height: 130,
        fill: [0.86, 0.92, 1],
        stroke: [0.1, 0.12, 0.2],
        labelColor: [0.1, 0.12, 0.2],
        strokeAlign,
        strokeWeight: 6
      }))
    )
  )
  await editor.canvas.waitForRender()
  editor.canvas.assertNoErrors()
  expect(await editor.canvas.screenshotCanvasRegion()).toMatchSnapshot(
    'shapes-with-text-aligned-strokes.png'
  )
})
