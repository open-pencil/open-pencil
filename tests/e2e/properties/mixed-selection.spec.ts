import { expect, test, useEditorSetupWithClear } from '#tests/e2e/fixtures'
import { mixedSelectionDriver } from '#tests/helpers/canvas/mixed-selection-driver'
import { propertyField, propertySection } from '#tests/helpers/properties'

// Figma desktop 126, probed with the same layers: a multi-selection shows layout, typography for
// its text, strokes of the layers that have them, selection colors, and the spacing of a row.

const editor = useEditorSetupWithClear('/?test&no-rulers')
const scene = mixedSelectionDriver(() => editor.page)

async function select(...layers: Parameters<typeof scene.select>) {
  await scene.build()
  await scene.select(...layers)
  await editor.canvas.waitForRender()
}

async function typeInto(property: string, name: string, value: string) {
  await propertyField(editor.page, property).click()
  const input = propertyField(editor.page, property).getByRole('spinbutton', { name })
  await input.fill(value)
  await input.press('Enter')
}

test('font size edits every selected text in one undo step and leaves the rest alone', async () => {
  await select('textA', 'textB', 'rectA')
  const typography = propertySection(editor.page, 'Typography')
  await expect(typography).toBeVisible()
  await expect(propertyField(editor.page, 'fontSize')).toHaveAttribute('data-mixed')

  await typeInto('fontSize', 'Font size', '20')
  expect(await scene.read('fontSize', 'textA', 'textB')).toEqual([20, 20])

  await scene.undo()
  expect(await scene.read('fontSize', 'textA', 'textB')).toEqual([16, 24])
})

test('text resizing applies to the text among other layers', async () => {
  await select('textA', 'textB', 'rectA')
  await propertySection(editor.page, 'Layout').getByRole('button', { name: 'Fixed size' }).click()
  expect(await scene.read('textAutoResize', 'textA', 'textB')).toEqual(['NONE', 'NONE'])
})

test('flow reads mixed for frames with different layouts and sets them all', async () => {
  await select('frame', 'auto')
  const layout = propertySection(editor.page, 'Layout')
  const vertical = layout.getByRole('button', { name: 'Vertical layout' })
  await expect(vertical).toHaveAttribute('aria-pressed', 'false')
  await vertical.click()
  expect(await scene.read('layoutMode', 'frame', 'auto')).toEqual(['VERTICAL', 'VERTICAL'])
})

test('a stroke on some layers shows as theirs and an edit strokes them all', async () => {
  await select('rectA', 'ellipse')
  await expect(
    propertySection(editor.page, 'Stroke').getByText('Click + to replace mixed strokes')
  ).toBeHidden()

  await typeInto('stroke-weight', 'W', '3')
  const strokes = await scene.read('strokes', 'rectA', 'ellipse')
  expect(strokes.map((list) => (list as Array<{ weight: number }>)[0]?.weight)).toEqual([3, 3])
})

test('spacing reads the gaps of a row and spaces it from its first layer', async () => {
  await select('rectA', 'rectB')
  await expect(propertyField(editor.page, 'selection-spacing')).toHaveAttribute(
    'aria-valuenow',
    '40'
  )

  await typeInto('selection-spacing', 'Spacing', '10')
  expect(await scene.read('x', 'rectA', 'rectB')).toEqual([0, 110])
})

test('selection colors recolour every paint that uses a colour', async () => {
  await select('rectA', 'ellipse')
  const colors = editor.page.getByTestId('selection-colors')
  await expect(colors.getByRole('textbox', { name: 'Selection colors' })).toHaveCount(3)

  const black = colors.getByRole('textbox', { name: 'Selection colors' }).first()
  await expect(black).toHaveValue('000000')
  await black.fill('00FF00')
  await black.press('Enter')
  const strokes = await scene.read('strokes', 'rectA')
  expect((strokes[0] as Array<{ color: { g: number } }>)[0]?.color.g).toBe(1)
})

test('stroke position edits every selected layer', async () => {
  await select('rectA', 'textA')
  const position = propertyField(editor.page, 'stroke-align')
  await expect(position).toContainText('Mixed')
  await position.click()
  await editor.page.getByRole('option', { name: 'Center' }).click()
  expect(await scene.read('strokeAlign', 'rectA', 'textA')).toEqual(['CENTER', 'CENTER'])
})
