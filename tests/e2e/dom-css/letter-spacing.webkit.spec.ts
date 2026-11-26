import type { Page } from '@playwright/test'

import { renderNodesToHTML } from '@open-pencil/core/io/formats/html'
import { SceneGraph, type SceneNode } from '@open-pencil/scene-graph'

import { expect, test } from '../fixtures'

const FONT = 'font-family: Arial; font-size: 40px; line-height: 50px'
const SPACING = 10
const WORDS = 'Hold Hold'

/** The width of `text`'s glyphs in this browser, without the spacing CSS puts after the last. */
async function glyphWidth(page: Page, text: string): Promise<number> {
  await page.setContent(
    `<span id="probe" style="${FONT}; letter-spacing: ${SPACING}px; white-space: pre">${text}</span>`
  )
  const width = await page.locator('#probe').evaluate((span) => span.getBoundingClientRect().width)
  return width - SPACING
}

function textLayer(graph: SceneGraph, parentId: string, props: Partial<SceneNode>): SceneNode {
  return graph.createNode('TEXT', parentId, {
    fontFamily: 'Arial',
    fontSize: 40,
    lineHeight: { value: 50, unit: 'PIXELS' },
    letterSpacing: { value: SPACING, unit: 'PIXELS' },
    height: 50,
    ...props
  })
}

async function showExport(page: Page, graph: SceneGraph, ids: string[]): Promise<void> {
  const { html } = await renderNodesToHTML(graph, ids, { html: 'fragment' })
  await page.setContent(`<body style="margin: 0">${html}</body>`)
}

const box = (page: Page, name: string) =>
  page.locator(`[data-open-pencil-node-id="${name}"]`).evaluate((element) => {
    const rect = element.getBoundingClientRect()
    const range = document.createRange()
    range.selectNodeContents(element)
    const lines = new Set([...range.getClientRects()].map((line) => Math.round(line.top))).size
    return {
      left: rect.left,
      right: rect.right,
      lines,
      ink: [...range.getClientRects()].reduce((right, line) => Math.max(right, line.right), 0)
    }
  })

test.describe('letter-spaced text in DOM/CSS export, as the canvas lays it out', () => {
  test('a line that fits by its glyphs stays on one line, and right-aligned lines end at the box', async ({
    page
  }) => {
    const glyphs = await glyphWidth(page, WORDS)
    const graph = new SceneGraph()
    const frame = graph.createNode('FRAME', graph.getPages()[0].id, { width: 400, height: 200 })
    // Wider than the glyphs, narrower than the glyphs and the spacing after the last.
    const width = Math.ceil(glyphs) + 1
    const fitted = textLayer(graph, frame.id, { text: WORDS, width, textAutoResize: 'HEIGHT' })
    const right = textLayer(graph, frame.id, {
      text: 'Hold',
      y: 100,
      width: 300,
      textAutoResize: 'HEIGHT',
      textAlignHorizontal: 'RIGHT'
    })

    await showExport(page, graph, [frame.id])

    expect((await box(page, fitted.id)).lines).toBe(1)
    const aligned = await box(page, right.id)
    // The last glyph ends at the layer's width; the spacing after it lies past the box.
    expect(aligned.ink - SPACING).toBeCloseTo(aligned.left + 300, 0)
  })

  test('auto-width text takes the room of its glyphs in auto layout', async ({ page }) => {
    const glyphs = await glyphWidth(page, 'Hold')
    const graph = new SceneGraph()
    const row = graph.createNode('FRAME', graph.getPages()[0].id, {
      layoutMode: 'HORIZONTAL',
      primaryAxisSizing: 'HUG',
      counterAxisSizing: 'HUG',
      width: 200,
      height: 50
    })
    const label = textLayer(graph, row.id, {
      text: 'Hold',
      width: glyphs,
      textAutoResize: 'WIDTH_AND_HEIGHT'
    })
    const after = graph.createNode('RECTANGLE', row.id, { width: 20, height: 20 })

    await showExport(page, graph, [row.id])

    const text = await box(page, label.id)
    expect((await box(page, after.id)).left - text.left).toBeCloseTo(glyphs, 0)
  })
})
