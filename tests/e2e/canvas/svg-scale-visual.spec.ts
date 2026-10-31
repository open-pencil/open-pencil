import { expect, test, useEditorSetupWithClear } from '#tests/e2e/fixtures'

const editor = useEditorSetupWithClear('/?test&no-chrome&no-rulers')

/** The size-12 clock from #1577. Half of a 24-unit view box rounds 11.99 onto the arc's start. */
const CLOCK = `<svg size={12} viewBox="0 0 24 24" stroke="#000000" strokeWidth={2.5} fill="none">
  <path d="M12 3A9 9 0 1 1 11.99 3ZM12 7V12L15 14" />
</svg>`

test('scaled inline SVG keeps a nearly closed clock outline', async () => {
  const rendered = await editor.page.evaluate(async (jsx) => {
    const automation = window.openPencil?.test?.automation
    if (!automation) throw new Error('Automation hooks are not available')
    const response = await automation('tool', {
      name: 'render',
      args: { jsx, x: 0, y: 0 }
    })
    const store = window.openPencil?.getStore?.()
    if (!store?.renderer) throw new Error('OpenPencil store not initialized')
    store.clearSelection()
    // The render tool flashes the new frame. That highlight is timed, so drop it before the shot.
    store.renderer._flashes.length = 0
    store.renderer.aiClearAll()
    // The outline is nine pixels across. Zoom so a missing circle exceeds the snapshot tolerance.
    store.state.zoom = 24
    store.state.panX = 56
    store.state.panY = 56
    store.requestRender()
    return response
  }, CLOCK)

  await editor.canvas.waitForRender()
  editor.canvas.assertNoErrors()

  expect(rendered).toMatchObject({ ok: true, result: { type: 'FRAME' } })
  expect(await editor.canvas.screenshotCanvasRegion(400, 400)).toMatchSnapshot(
    'scaled-svg-clock-outline.png'
  )
})
