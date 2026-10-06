import { Buffer } from 'node:buffer'

import type { Page } from '@playwright/test'

import type { FontManager } from '#core/text/fonts'

import { expect, test } from '#tests/e2e/fixtures'
import { CanvasHelper } from '#tests/helpers/canvas'
import { mockFontsource } from '#tests/helpers/fonts/fontsource'
import { trackFontModuleResources } from '#tests/helpers/fonts/runtime'

async function openEditor(page: Page): Promise<void> {
  await trackFontModuleResources(page)
  // The variable fixture is installed explicitly; remote arrivals must not race it.
  await mockFontsource(page, [])
  await page.goto('/?test&no-chrome&no-rulers')
  await new CanvasHelper(page).waitForInit()
}

test('variable fonts render each style at its named instance', async ({ page }) => {
  await openEditor(page)

  const result = await page.evaluate(async () => {
    const store = window.openPencil?.getStore?.()
    if (!store?.renderer) throw new Error('OpenPencil renderer not initialized')
    const fontModuleURL = performance
      .getEntriesByType('resource')
      .map((entry) => entry.name)
      .find((url) => url.includes('/packages/core/src/text/fonts.ts'))
    if (!fontModuleURL) throw new Error('Active font manager module not found')
    const { fontManager } = (await import(/* @vite-ignore */ fontModuleURL)) as {
      fontManager: FontManager
    }
    const pageId = store.state.currentPageId
    for (const id of store.graph.getNode(pageId)?.childIds.slice() ?? []) {
      store.graph.deleteNode(id)
    }

    // One variable file serves every style, as installed variable fonts such as SF Pro do.
    const data = await fetch('/tests/fixtures/fonts/InterVariable-Latin.ttf').then((response) =>
      response.arrayBuffer()
    )
    for (const style of ['Regular', 'Medium', 'SemiBold', 'Bold']) {
      fontManager.markLoaded('Inter Variable', style, data)
    }

    const samples = [
      { label: 'Regular 400', fontWeight: 400 },
      { label: 'Medium 500', fontWeight: 500 },
      { label: 'SemiBold 600', fontWeight: 600 },
      { label: 'Bold 700', fontWeight: 700 },
      {
        label: 'Bold, explicit wght 300',
        fontWeight: 700,
        fontVariations: [{ axis: 'wght', value: 300 }]
      }
    ]
    const ids = samples.map(
      (sample, index) =>
        store.graph.createNode('TEXT', pageId, {
          name: sample.label,
          x: 40,
          y: 40 + index * 56,
          width: 520,
          height: 44,
          text: `${sample.label} — Buttons`,
          fontFamily: 'Inter Variable',
          fontSize: 32,
          fontWeight: sample.fontWeight,
          fontVariations: sample.fontVariations ?? [],
          textAutoResize: 'NONE',
          fills: [
            { type: 'SOLID', color: { r: 0.04, g: 0.06, b: 0.12, a: 1 }, visible: true, opacity: 1 }
          ]
        }).id
    )

    await store.loadFontsForNodes(ids)
    store.renderer.invalidateAllPictures()
    store.requestRender()
    const image = await store.renderExportImage(ids, 2, 'PNG')
    if (!image) throw new Error('Export failed')
    return {
      image: Array.from(image),
      readiness: ids.map((id) => {
        const node = store.graph.getNode(id)
        return node ? store.renderer?.nodeFontReadiness(node) : 'missing'
      })
    }
  })

  expect(result.readiness).toEqual(['ready', 'ready', 'ready', 'ready', 'ready'])
  expect(Buffer.from(result.image)).toMatchSnapshot('variable-font-weights.png')
})
