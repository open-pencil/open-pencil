import { expect, test, useEditorSetupWithClear } from '#tests/e2e/fixtures'
import { gradientDriver } from '#tests/helpers/canvas/gradient-driver'

// Figma desktop 126: a linear gradient shows its line, end dots, and stop squares; radial and
// diamond add a centre and a second radius dot; angular draws its ellipse with squares outside it.

const editor = useEditorSetupWithClear('/?test&no-chrome&no-rulers')

const gradient = gradientDriver(() => editor.page)

for (const type of [
  'GRADIENT_LINEAR',
  'GRADIENT_RADIAL',
  'GRADIENT_ANGULAR',
  'GRADIENT_DIAMOND'
] as const) {
  test(`${type.toLowerCase()} gradient handles`, async () => {
    const nodeId = await gradient.show(type)
    await gradient.edit(nodeId)
    await editor.canvas.waitForRender()
    expect(await editor.canvas.screenshotCanvasRegion(600, 480)).toMatchSnapshot(
      `${type.toLowerCase()}.png`
    )
    editor.canvas.assertNoErrors()
  })
}
