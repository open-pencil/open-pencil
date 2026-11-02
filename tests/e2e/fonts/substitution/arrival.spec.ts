import { expect, test } from '#tests/e2e/fixtures'
import { CanvasHelper } from '#tests/helpers/canvas'
import { trackFontModuleResources } from '#tests/helpers/fonts/runtime'

const FAMILY = 'Late Arriving Test Face'

interface Sizes {
  readiness: string | undefined
  text: number
  frame: number
}

test('text measured in a substitute takes its own face’s size once that face arrives', async ({
  page
}) => {
  await trackFontModuleResources(page)
  await page.goto('/?test&no-chrome&no-rulers')
  const canvas = new CanvasHelper(page)
  await canvas.waitForInit()
  await canvas.clearCanvas()

  const ids = await page.evaluate(async (family) => {
    const store = window.openPencil?.getStore?.()
    if (!store?.renderer) throw new Error('OpenPencil renderer not initialized')
    const resolverURL = performance
      .getEntriesByType('resource')
      .map((entry) => entry.name)
      .find((url) => url.includes('/packages/core/src/text/resolver/index.ts'))
    if (!resolverURL) throw new Error('Active font resolver module not found')
    const { fontFaceDemand, fontResolver } = await import(/* @vite-ignore */ resolverURL)
    const text = 'Arriving label'
    // The face is found nowhere, so the text measures in the substitute it draws in.
    fontResolver.exhaust(fontFaceDemand(family, 'Regular', text))
    const pageId = store.state.currentPageId
    const frame = store.graph.createNode('FRAME', pageId, {
      x: 120,
      y: 150,
      layoutMode: 'HORIZONTAL',
      primaryAxisSizing: 'HUG',
      counterAxisSizing: 'HUG',
      paddingLeft: 16,
      paddingRight: 16,
      paddingTop: 12,
      paddingBottom: 12
    })
    const node = store.graph.createNode('TEXT', frame.id, {
      text: '',
      fontFamily: family,
      fontSize: 40,
      textAutoResize: 'WIDTH_AND_HEIGHT'
    })
    store.updateNode(node.id, { text })
    return { frame: frame.id, text: node.id }
  }, FAMILY)

  const sizes = () =>
    page.evaluate(({ frame, text }): Sizes | null => {
      const store = window.openPencil?.getStore?.()
      const textNode = store?.graph.getNode(text)
      const frameNode = store?.graph.getNode(frame)
      if (!textNode || !frameNode) return null
      return {
        readiness: store?.renderer?.nodeFontReadiness(textNode),
        text: textNode.width,
        frame: frameNode.width
      }
    }, ids)

  await expect.poll(async () => (await sizes())?.readiness).toBe('substituted')
  const substituted = await sizes()
  expect(substituted?.text).toBeGreaterThan(0)
  expect(substituted?.frame).toBe((substituted?.text ?? 0) + 32)

  await page.evaluate(async (family) => {
    const managerURL = performance
      .getEntriesByType('resource')
      .map((entry) => entry.name)
      .find((url) => url.includes('/packages/core/src/text/font/manager.ts'))
    if (!managerURL) throw new Error('Active font manager module not found')
    const { fontManager } = await import(/* @vite-ignore */ managerURL)
    // A wider face than the substitute, registered as the family's own, as installing it would.
    const data = await fontManager.fetchBundledFont('/Inter-SemiBold.ttf')
    if (!data) throw new Error('Bundled Inter SemiBold not served')
    await fontManager.markLoaded(family, 'Regular', data)
  }, FAMILY)

  await expect.poll(async () => (await sizes())?.readiness).toBe('ready')
  await expect.poll(async () => (await sizes())?.text).toBeGreaterThan(substituted?.text ?? 0)
  const arrived = await sizes()
  expect(arrived?.frame).toBe((arrived?.text ?? 0) + 32)
  canvas.assertNoErrors()
})
