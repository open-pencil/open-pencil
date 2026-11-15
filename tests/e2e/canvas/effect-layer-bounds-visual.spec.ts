import { expect, test, useEditorSetupWithClear } from '#tests/e2e/fixtures'
import { layerBoundsDriver } from '#tests/helpers/canvas/layer-bounds/driver'

test.use({ deviceScaleFactor: 1 })

const editor = useEditorSetupWithClear('/?test&no-chrome&no-rulers')
const scene = layerBoundsDriver(() => editor.page)

test('layers keep what a node draws past its box: glow, a child’s shadow, a turned mask', async () => {
  await scene.show()
  // The snapshot comparison tolerates a few pixels; a halo cut to the node's box is only a few.
  for (const [probe, ink] of Object.entries(await scene.inkAtProbes())) {
    expect.soft(ink, probe).toBeGreaterThan(60)
  }
  editor.canvas.assertNoErrors()
  expect(await scene.capture()).toMatchSnapshot('effect-layer-bounds.png')
})
