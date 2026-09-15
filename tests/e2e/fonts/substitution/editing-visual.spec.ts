import { expect, test } from '#tests/e2e/fixtures'
import { CanvasHelper } from '#tests/helpers/canvas'
import { trackFontModuleResources } from '#tests/helpers/fonts/runtime'

async function expectCanvas(canvas: CanvasHelper, name: string): Promise<void> {
  await canvas.waitForRender()
  canvas.assertNoErrors()
  expect(await canvas.screenshotCanvasRegion()).toMatchSnapshot(`${name}.png`)
}

test('first edit replaces baked missing-font glyphs with visible live substitution', async ({
  page
}) => {
  await trackFontModuleResources(page)
  await page.goto('/?test&no-chrome&no-rulers')
  const editor = { page, canvas: new CanvasHelper(page) }
  await editor.canvas.waitForInit()
  await editor.canvas.clearCanvas()
  const textId = await editor.page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store?.renderer) throw new Error('OpenPencil renderer not initialized')
    const pageId = store.state.currentPageId
    const node = store.graph.createNode('TEXT', pageId, {
      name: 'Missing font text',
      x: 120,
      y: 150,
      width: 520,
      height: 90,
      text: 'Missing font stays visible',
      fontFamily: 'Inter',
      fontSize: 40,
      fontWeight: 400,
      textAutoResize: 'NONE',
      fills: [
        { type: 'SOLID', color: { r: 0.06, g: 0.08, b: 0.14, a: 1 }, visible: true, opacity: 1 }
      ]
    })
    const baked = store.renderer.buildTextPicture(node)
    if (!baked) throw new Error('Could not build baked text fixture')
    node.fontFamily = 'Unavailable Visual Test Face'
    const fontModuleURL = performance
      .getEntriesByType('resource')
      .map((entry) => entry.name)
      .find((url) => url.includes('/packages/core/src/text/resolver/index.ts'))
    if (!fontModuleURL) throw new Error('Active font resolver module not found')
    void import(/* @vite-ignore */ fontModuleURL).then(({ fontFaceDemand, fontResolver }) => {
      fontResolver.exhaust(fontFaceDemand(node.fontFamily, 'Regular', node.text))
      store.requestRender()
      return node.id
    })
    node.textPicture = baked
    store.select([node.id])
    store.requestRender()
    return node.id
  })

  await editor.page.waitForFunction((id) => {
    const store = window.openPencil?.getStore?.()
    const node = store?.graph.getNode(id)
    return node ? store?.renderer?.nodeFontReadiness(node) === 'substituted' : false
  }, textId)
  await expectCanvas(editor.canvas, 'missing-font-baked-before-edit')

  await editor.page.keyboard.press('Enter')
  const textarea = editor.page.locator('textarea[aria-hidden="true"]')
  await textarea.fill('!')
  await textarea.dispatchEvent('input')
  await expectCanvas(editor.canvas, 'missing-font-live-substitution-after-first-edit')

  const edited = await editor.page.evaluate((id) => {
    const store = window.openPencil?.getStore?.()
    const node = store?.graph.getNode(id)
    return node?.type === 'TEXT'
      ? {
          text: node.text,
          textPicture: node.textPicture,
          derivedTextGlyphs: node.derivedTextGlyphs,
          readiness: store?.renderer?.nodeFontReadiness(node)
        }
      : null
  }, textId)
  expect(edited).toEqual({
    text: '!',
    textPicture: null,
    derivedTextGlyphs: null,
    readiness: 'substituted'
  })

  await editor.page.keyboard.press('Escape')
  await editor.canvas.undo()
  await expectCanvas(editor.canvas, 'missing-font-substitution-after-undo')
})
