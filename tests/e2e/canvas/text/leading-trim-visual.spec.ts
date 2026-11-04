import type { Page } from '@playwright/test'

import { expect, test } from '#tests/e2e/fixtures'
import { CanvasHelper } from '#tests/helpers/canvas'

interface Sample {
  x: number
  text: string
  fontSize: number
  lineHeight: number
  trim: 'CAP_HEIGHT' | 'NONE'
}

/**
 * Lays each sample out in a tinted frame that hugs it on a white card, so the text's box shows
 * against its ink, and returns the frames' heights.
 */
async function drawSamples(
  page: Page,
  card: { width: number; height: number },
  samples: Sample[]
): Promise<number[]> {
  await page.goto('/?test&no-chrome&no-rulers')
  const canvas = new CanvasHelper(page)
  await canvas.waitForInit()
  const heights = await page.evaluate(
    async ({ card, samples }) => {
      const store = window.openPencil?.getStore?.()
      if (!store) throw new Error('Editor unavailable')
      const solid = (r: number, g: number, b: number) => ({
        type: 'SOLID' as const,
        color: { r, g, b, a: 1 },
        visible: true,
        opacity: 1
      })
      const frame = store.graph.createNode('FRAME', store.state.currentPageId, {
        name: 'Card',
        ...card,
        fills: [solid(1, 1, 1)]
      })
      const boxes = samples.map((sample) => {
        const box = store.graph.createNode('FRAME', frame.id, {
          name: sample.trim,
          x: sample.x,
          y: 20,
          width: 40,
          height: 40,
          layoutMode: 'VERTICAL',
          primaryAxisSizing: 'HUG',
          counterAxisSizing: 'HUG',
          fills: [solid(0.85, 0.92, 1)]
        })
        store.graph.createNode('TEXT', box.id, {
          name: sample.text,
          text: sample.text,
          width: 40,
          height: 30,
          fontFamily: 'Inter',
          fontSize: sample.fontSize,
          lineHeight: { value: sample.lineHeight, unit: 'PIXELS' },
          leadingTrim: sample.trim,
          textAutoResize: 'WIDTH_AND_HEIGHT',
          fills: [solid(0.1, 0.1, 0.1)]
        })
        return box.id
      })
      await store.loadFontsForNodes([frame.id])
      store.requestRender()
      return boxes.map((id) => store.graph.getNode(id)?.height ?? 0)
    },
    { card, samples }
  )
  await canvas.waitForRender()
  return heights
}

test('a cap-height trimmed text ends its box at the last baseline, as Figma does', async ({
  page
}) => {
  // Figma makes the box the trimmed height to the nearest pixel, and the cap height overhangs it.
  await drawSamples(page, { width: 420, height: 120 }, [
    { x: 10, text: 'H8', fontSize: 24, lineHeight: 30, trim: 'CAP_HEIGHT' },
    { x: 70, text: 'H8\nH8', fontSize: 24, lineHeight: 30, trim: 'CAP_HEIGHT' },
    { x: 130, text: 'Hg', fontSize: 23, lineHeight: 30, trim: 'CAP_HEIGHT' },
    { x: 190, text: 'H8', fontSize: 30, lineHeight: 30, trim: 'CAP_HEIGHT' },
    { x: 260, text: 'H8', fontSize: 24, lineHeight: 30, trim: 'NONE' }
  ])
  const canvas = new CanvasHelper(page)
  expect(await canvas.screenshotCanvasRegion(420, 120)).toMatchSnapshot('leading-trim.png')
})

test('a trimmed text steps a fractional line height onto whole pixels of its box', async ({
  page
}) => {
  // Figma desktop 126 makes four lines of 23 px Inter at 30.6 px 109 px tall trimmed, with
  // baselines on whole pixels from the cap height, and 123 px untrimmed.
  const text = 'H8\nH8\nH8\nH8'
  const heights = await drawSamples(page, { width: 160, height: 160 }, [
    { x: 10, text, fontSize: 23, lineHeight: 30.6, trim: 'CAP_HEIGHT' },
    { x: 80, text, fontSize: 23, lineHeight: 30.6, trim: 'NONE' }
  ])
  expect(heights).toEqual([109, 123])
  const canvas = new CanvasHelper(page)
  expect(await canvas.screenshotCanvasRegion(160, 160)).toMatchSnapshot(
    'leading-trim-fractional.png'
  )
})
