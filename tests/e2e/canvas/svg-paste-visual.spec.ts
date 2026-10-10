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
  const pasted = await editor.page.evaluate(async (markup) => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    const done = await store.pasteSVG(markup, 220, 160)
    store.clearSelection()
    store.requestRender()
    return done
  }, CLIPPED_SVG)
  expect(pasted).toBe(true)
  await editor.canvas.waitForRender()
  editor.canvas.assertNoErrors()
  expect(await editor.canvas.screenshotCanvasRegion()).toMatchSnapshot('svg-clip-mask-groups.png')
})

// Figma 126 makes these layers 48×24, 44×24, and 35×24, the last centred on x = 100.
const TEXT_SVG = `<svg viewBox="0 0 200 130" width="200" height="130">
  <text x="10" y="30" font-family="Inter" font-size="20">Hello</text>
  <text x="10" y="70" font-family="Inter" font-size="20" font-weight="700" fill="#4F46E5">Bold</text>
  <text x="100" y="110" font-family="Inter" font-size="20" text-anchor="middle">Mid</text>
</svg>`

test('pasted SVG text measures and draws as Figma lays it out', async () => {
  const layers = await editor.page.evaluate(async (markup) => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    await store.pasteSVG(markup, 220, 160)
    store.clearSelection()
    store.requestRender()
    return [...store.graph.getAllNodes()]
      .filter((node) => node.type === 'TEXT')
      .map(({ text, x, width, height }) => ({ text, x, width, height }))
  }, TEXT_SVG)
  const expected = [
    { text: 'Hello', width: 48, height: 24 },
    { text: 'Bold', width: 44, height: 24 },
    { text: 'Mid', width: 35, height: 24 }
  ]
  expect(layers.map(({ text }) => text)).toEqual(expected.map(({ text }) => text))
  for (const [index, layer] of layers.entries()) {
    expect(Math.abs(layer.width - expected[index].width)).toBeLessThanOrEqual(2)
    expect(layer.height).toBe(expected[index].height)
  }
  const mid = layers[2]
  expect(mid.x + mid.width / 2).toBeCloseTo(100, 0)
  await editor.canvas.waitForRender()
  editor.canvas.assertNoErrors()
  expect(await editor.canvas.screenshotCanvasRegion()).toMatchSnapshot('svg-text-layers.png')
})
