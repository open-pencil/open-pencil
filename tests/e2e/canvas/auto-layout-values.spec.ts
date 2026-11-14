import { expect, test, useEditorSetupWithClear } from '#tests/e2e/fixtures'
import { autoLayoutValuesDriver } from '#tests/helpers/canvas/auto-layout-values/driver'
import type { ValueSceneVariant } from '#tests/helpers/canvas/auto-layout-values/scene'

// The pills Figma desktop 126 shows over a gap and a padding: as wide as the value, centred.

const editor = useEditorSetupWithClear('/?test&no-chrome&no-rulers')

test('a gap and a padding show their values in pills that fit them', async () => {
  const scene = autoLayoutValuesDriver(() => editor.page)
  await scene.build()
  for (const [name, x] of [
    ['gap', 37 + 80 + 4],
    ['padding', 18]
  ] as const) {
    const point = scene.point(x, 50)
    await editor.canvas.hover(point.x, point.y)
    editor.canvas.assertNoErrors()
    const buffer = await editor.canvas.screenshotCanvasRegion(700, 400)
    expect(buffer).toMatchSnapshot(`auto-layout-${name}-value.png`, {
      maxDiffPixelRatio: 0,
      threshold: 0
    })
  }
})

// Figma desktop (2026-11-14) draws a gap's tick in the middle of the content box, inside the
// paddings, not in the frame's middle; the hover follows a turned frame.
const GAP_X = 37 + 80 + 4

async function hoverGap(variant: ValueSceneVariant, height: number, name: string) {
  const scene = autoLayoutValuesDriver(() => editor.page)
  await scene.build(variant)
  const turn = variant.rotation ? { rotation: variant.rotation, width: 242, height } : undefined
  const point = scene.point(GAP_X, (variant.paddingTop ?? 20) + 30, turn)
  await editor.canvas.hover(point.x, point.y)
  editor.canvas.assertNoErrors()
  const buffer = await editor.canvas.screenshotCanvasRegion(700, 500)
  expect(buffer).toMatchSnapshot(`auto-layout-gap-${name}.png`, {
    maxDiffPixelRatio: 0,
    threshold: 0
  })
}

test("a gap's tick sits in the middle of the content box, inside unequal paddings", async () => {
  await hoverGap({ paddingTop: 30, paddingBottom: 0 }, 90, 'uneven-padding')
})

test("a turned frame's gap hovers and draws where the frame is", async () => {
  await hoverGap({ rotation: 30 }, 100, 'turned')
})
