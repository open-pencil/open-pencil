import { Buffer } from 'node:buffer'

import type { Page } from '@playwright/test'

import type { SceneNode } from '@open-pencil/scene-graph'

import type { FontManager } from '#core/text/font/manager'

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

/** A variable font fixture, installed under a family for the styles it draws. */
interface VariableFixture {
  file: string
  family: string
  styles: string[]
}

const INTER_VARIABLE: VariableFixture = {
  file: 'InterVariable-Latin.ttf',
  family: 'Inter Variable',
  styles: ['Regular', 'Medium', 'SemiBold', 'Bold']
}

/**
 * Lines of text in a variable font fixture, one under the other at 32 px, each with its own
 * fields over the defaults, exported as a PNG with how ready each line's fonts were.
 */
async function exportLines(
  page: Page,
  lines: Array<Partial<SceneNode> & { text: string }>,
  font: VariableFixture = INTER_VARIABLE
) {
  return page.evaluate(
    async ({ lines, font }) => {
      const store = window.openPencil?.getStore?.()
      if (!store?.renderer) throw new Error('OpenPencil renderer not initialized')
      const fontModuleURL = performance
        .getEntriesByType('resource')
        .map((entry) => entry.name)
        .find((url) => url.includes('/packages/core/src/text/font/manager.ts'))
      if (!fontModuleURL) throw new Error('Active font manager module not found')
      const { fontManager } = (await import(/* @vite-ignore */ fontModuleURL)) as {
        fontManager: FontManager
      }
      const pageId = store.state.currentPageId
      for (const id of store.graph.getNode(pageId)?.childIds.slice() ?? []) {
        store.graph.deleteNode(id)
      }

      // One variable file serves every style, as installed variable fonts such as SF Pro do.
      const data = await fetch(`/tests/fixtures/fonts/${font.file}`).then((response) =>
        response.arrayBuffer()
      )
      for (const style of font.styles) {
        await fontManager.markLoaded(font.family, style, data)
      }

      const ids = lines.map(
        (line, index) =>
          store.graph.createNode('TEXT', pageId, {
            name: line.text,
            x: 40,
            y: 40 + index * 56,
            width: 520,
            height: 44,
            fontFamily: font.family,
            fontSize: 32,
            textAutoResize: 'NONE',
            fills: [
              {
                type: 'SOLID',
                color: { r: 0.04, g: 0.06, b: 0.12, a: 1 },
                visible: true,
                opacity: 1
              }
            ],
            ...line
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
    },
    { lines, font }
  )
}

test('variable fonts render each style at its named instance', async ({ page }) => {
  await openEditor(page)

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
  const result = await exportLines(
    page,
    samples.map(({ label, ...fields }) => ({ text: `${label} — Buttons`, ...fields }))
  )

  expect(result.readiness).toEqual(['ready', 'ready', 'ready', 'ready', 'ready'])
  expect(Buffer.from(result.image)).toMatchSnapshot('variable-font-weights.png')
})

test('a range draws at its own optical size, as Figma saves one', async ({ page }) => {
  await openEditor(page)

  // At 32 px automatic optical size is 32; the fixture's axis runs from 14 to 32.
  const fixed = { opticalSizeFromFontSize: false, fontVariations: [{ axis: 'opsz', value: 14 }] }
  const result = await exportLines(page, [
    { text: 'Automatic optical size' },
    { text: 'Automatic, then fixed 14', styleRuns: [{ start: 11, length: 13, style: fixed }] },
    { text: 'Fixed optical size 14', ...fixed }
  ])

  expect(result.readiness).toEqual(['ready', 'ready', 'ready'])
  expect(Buffer.from(result.image)).toMatchSnapshot('variable-font-optical-size-ranges.png')
})

test('a face named apart from its weight draws at the named instance of that name', async ({
  page
}) => {
  await openEditor(page)

  // Inter with an extra instance, "Display Heavy" at wght 850, as Roboto has "Condensed Bold".
  const result = await exportLines(
    page,
    [
      { text: 'Display Heavy, by name', fontWeight: 850, fontStyle: 'Display Heavy' },
      { text: 'Regular, wght 850', fontVariations: [{ axis: 'wght', value: 850 }] },
      { text: 'Weight 850, no name', fontWeight: 850 }
    ],
    { file: 'InterVariable-Named.ttf', family: 'Inter Named', styles: ['Regular'] }
  )

  expect(result.readiness).toEqual(['ready', 'ready', 'ready'])
  expect(Buffer.from(result.image)).toMatchSnapshot('variable-font-named-instance.png')
})

test('a list marker draws in its item’s face, named apart from its weight too', async ({
  page
}) => {
  await openEditor(page)

  // The number follows the face of its item's first character, as Figma draws it.
  const list = { textParagraphs: [{ listType: 'ORDERED' as const, indentation: 1 }] }
  const heavy = { fontWeight: 850, fontStyle: 'Display Heavy' }
  const result = await exportLines(
    page,
    [
      { text: 'Display Heavy item', ...list, styleRuns: [{ start: 0, length: 18, style: heavy }] },
      { text: 'Regular item', ...list }
    ],
    { file: 'InterVariable-Named.ttf', family: 'Inter Named', styles: ['Regular'] }
  )

  expect(result.readiness).toEqual(['ready', 'ready'])
  expect(Buffer.from(result.image)).toMatchSnapshot('variable-font-named-list-marker.png')
})
