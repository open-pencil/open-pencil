import { expect, test, useEditorSetupWithClear } from '#tests/e2e/fixtures'
import { readScenePixels } from '#tests/helpers/canvas/pixels'

const editor = useEditorSetupWithClear('/?test&no-chrome&no-rulers')

/** The size-12 clock from #1577. Half of a 24-unit view box rounds 11.99 onto the arc's start. */
const CLOCK = `<svg size={12} viewBox="0 0 24 24" stroke="#000000" strokeWidth={2.5} fill="none">
  <path d="M12 3A9 9 0 1 1 11.99 3ZM12 7V12L15 14" />
</svg>`

/** Zoom and pan that place the icon's circle on whole viewport pixels. */
const ZOOM = 24
const PAN = 56

/**
 * Scaled circle: view-box center (12, 12) and radius 9, halved with the icon.
 * The hands run from (6, 3.5) to the center and on to (7.5, 7), short of the ring.
 */
const CENTER = 6
const RADIUS = 4.5

/** Channels at or below this are the black stroke, not the light page. */
const STROKE_MAX = 32
/** Channels at or above this are the page (about 245), not the stroke. */
const PAGE_MIN = 220

function viewportPoint(x: number, y: number) {
  return { x: x * ZOOM + PAN, y: y * ZOOM + PAN }
}

/** 0/90/180/270 degrees on the ring: east, south, west, north. */
const ring = [
  viewportPoint(CENTER + RADIUS, CENTER),
  viewportPoint(CENTER, CENTER + RADIUS),
  viewportPoint(CENTER - RADIUS, CENTER),
  viewportPoint(CENTER, CENTER - RADIUS)
]
/** Lower-left of the dial, inside the ring and clear of both hands. */
const inside = viewportPoint(CENTER - 2, CENTER + 2)

test('scaled inline SVG keeps a nearly closed clock outline', async () => {
  const rendered = await editor.page.evaluate(
    async ({ jsx, zoom, pan }) => {
      const automation = window.openPencil?.test?.automation
      if (!automation) throw new Error('Automation hooks are not available')
      const response = await automation('tool', {
        name: 'render',
        args: { jsx, x: 0, y: 0 }
      })
      const store = window.openPencil?.getStore?.()
      if (!store?.renderer) throw new Error('OpenPencil store not initialized')
      store.clearSelection()
      // The render tool flashes the new frame. That highlight is timed, so drop it before sampling.
      store.renderer._flashes.length = 0
      store.renderer.aiClearAll()
      // The outline is nine pixels across. Zoom so a sample on the ring is solid stroke.
      store.state.zoom = zoom
      store.state.panX = pan
      store.state.panY = pan
      store.requestRender()
      return response
    },
    { jsx: CLOCK, zoom: ZOOM, pan: PAN }
  )

  await editor.canvas.waitForRender()
  editor.canvas.assertNoErrors()

  expect(rendered).toMatchObject({ ok: true, result: { type: 'FRAME' } })
  const [east, south, west, north, dial] = await readScenePixels(editor.page, [...ring, inside])
  for (const [r, g, b, a] of [east, south, west, north]) {
    expect(a).toBe(255)
    expect(Math.max(r, g, b)).toBeLessThanOrEqual(STROKE_MAX)
  }
  const [r, g, b, a] = dial
  expect(a).toBe(255)
  expect(Math.min(r, g, b)).toBeGreaterThanOrEqual(PAGE_MIN)
})
