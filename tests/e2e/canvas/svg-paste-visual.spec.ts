import { expect, test, useEditorSetupWithClear } from '#tests/e2e/fixtures'

const editor = useEditorSetupWithClear('/?test&no-chrome&no-rulers')

const CLIPPED_SVG = `<svg viewBox="0 0 200 120" width="200" height="120">
  <defs>
    <clipPath id="badge"><circle cx="60" cy="60" r="44"/><rect x="120" y="20" width="60" height="80" rx="12"/></clipPath>
  </defs>
  <g id="art" clip-path="url(#badge)">
    <rect width="200" height="60" fill="#4F46E5"/>
    <rect y="60" width="200" height="60" fill="#F59E0B"/>
  </g>
  <path d="M40 60l14 14 26-30" fill="none" stroke="#fff" stroke-width="8" stroke-linecap="round"/>
</svg>`

test('pasted SVG clip paths draw through their mask groups', async () => {
  const pasted = await editor.page.evaluate((markup) => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    const done = store.pasteSVG(markup, 220, 160)
    store.clearSelection()
    store.requestRender()
    return done
  }, CLIPPED_SVG)
  expect(pasted).toBe(true)
  await editor.canvas.waitForRender()
  editor.canvas.assertNoErrors()
  expect(await editor.canvas.screenshotCanvasRegion()).toMatchSnapshot('svg-clip-mask-groups.png')
})
