import { expect, test, useEditorSetupWithClear } from '#tests/e2e/fixtures'
import { shapeHandlesDriver } from '#tests/helpers/canvas/shape-handles-driver'
import { propertySection } from '#tests/helpers/properties'

// Figma desktop: a polygon's or star's corners share one radius, shown and edited in the panel
// with smoothing but without independent corners.

const editor = useEditorSetupWithClear('/?test&no-rulers')

const corners = shapeHandlesDriver(() => editor.page)

for (const type of ['POLYGON', 'STAR'] as const) {
  test(`a ${type.toLowerCase()} edits its one radius in the panel`, async () => {
    const nodeId = await corners.show({ pointCount: 5, cornerRadius: 12 }, type)
    await editor.canvas.waitForRender()
    const section = propertySection(editor.page, 'Appearance')
    const radius = section.getByRole('spinbutton', { name: 'Radius', exact: true })
    await expect(radius).toHaveText('12')
    await expect(section.getByRole('button', { name: 'Independent corner radii' })).toHaveCount(0)
    await expect(editor.page.locator('[data-property="corner-smoothing"]')).toBeVisible()

    await radius.focus()
    await radius.fill('20')
    await radius.press('Enter')
    await editor.canvas.waitForRender()
    expect((await corners.radii(nodeId))?.[0]).toBe(20)
  })
}

async function fill(name: string, value: string) {
  const field = propertySection(editor.page, 'Appearance').getByRole('spinbutton', {
    name,
    exact: true
  })
  await field.focus()
  await field.fill(value)
  await field.press('Enter')
  await editor.canvas.waitForRender()
}

test('a star edits its point count and inner ratio, which Figma keeps between 3 and 60', async () => {
  const nodeId = await corners.show({ pointCount: 5, starInnerRadius: 0.382 }, 'STAR')
  await editor.canvas.waitForRender()
  const section = propertySection(editor.page, 'Appearance')
  await expect(section.getByRole('spinbutton', { name: 'Count', exact: true })).toHaveText('5')
  await expect(section.getByRole('spinbutton', { name: 'Ratio', exact: true })).toHaveText(/38\.2/)

  await fill('Count', '7')
  await fill('Ratio', '50')
  expect(await corners.points(nodeId)).toEqual({ count: 7, ratio: 0.5 })

  await fill('Count', '100')
  expect((await corners.points(nodeId))?.count).toBe(60)
})

test('a polygon has a point count but no inner ratio', async () => {
  await corners.show({ pointCount: 3 }, 'POLYGON')
  await editor.canvas.waitForRender()
  const section = propertySection(editor.page, 'Appearance')
  await expect(section.getByRole('spinbutton', { name: 'Count', exact: true })).toHaveText('3')
  await expect(section.getByRole('spinbutton', { name: 'Ratio', exact: true })).toHaveCount(0)
})
