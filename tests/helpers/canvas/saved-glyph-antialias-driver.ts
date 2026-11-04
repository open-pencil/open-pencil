import { readFile } from 'node:fs/promises'

import type { Page } from '@playwright/test'
import { fromUint8Array } from 'js-base64'

import { expectDefined } from '@open-pencil/test-support/assert'

import { CanvasHelper } from '#tests/helpers/canvas'

const UNAVAILABLE_FAMILY = 'Repro Unavailable Sans'
const SAMPLES = [
  { fontSize: 20, fontWeight: 400, fontStyle: 'Regular' },
  { fontSize: 18, fontWeight: 400, fontStyle: 'Regular' },
  { fontSize: 20, fontWeight: 600, fontStyle: 'SemiBold' }
]
const ROW_TOP = 12
const ROW_PITCH = 40

export function savedGlyphAntialiasDriver(page: () => Page) {
  const canvas = () => new CanvasHelper(page())

  async function settle() {
    await page().evaluate(() => window.openPencil?.test?.navigation?.waitForSettlement())
    await page().evaluate(
      () =>
        new Promise<void>((resolve) => {
          requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
        })
    )
  }

  async function savedFigBytes(): Promise<number[]> {
    const picker = await page().evaluateHandle(() => {
      const original = window.showSaveFilePicker
      window.showSaveFilePicker = undefined
      return {
        restore: () => {
          window.showSaveFilePicker = original
        }
      }
    })
    try {
      page().once('dialog', (dialog) => dialog.accept('Saved glyphs.fig'))
      const download = page().waitForEvent('download')
      await page().evaluate(() => window.openPencil?.getStore?.().saveFigFileAs())
      return [...(await readFile(expectDefined(await (await download).path(), 'download')))]
    } finally {
      await picker.evaluate((handle) => handle.restore())
      await picker.dispose()
    }
  }

  async function createLiveText() {
    await page().evaluate(
      async ({ samples, top, pitch }) => {
        const store = window.openPencil?.getStore?.()
        if (!store) throw new Error('Editor unavailable')
        const pageId = store.state.currentPageId
        const solid = (value: number) => [
          {
            type: 'SOLID' as const,
            color: { r: value, g: value, b: value, a: 1 },
            opacity: 1,
            visible: true
          }
        ]
        store.graph.createNode('RECTANGLE', pageId, {
          name: 'Paper',
          width: 180,
          height: 140,
          fills: solid(1)
        })
        for (const [index, sample] of samples.entries()) {
          store.graph.createNode('TEXT', pageId, {
            ...sample,
            name: `Saved ${sample.fontSize}/${sample.fontWeight}`,
            text: `Quick AVW ${sample.fontSize}`,
            x: 12,
            y: top + index * pitch,
            width: 150,
            height: 30,
            fontFamily: 'Inter',
            textAutoResize: 'WIDTH_AND_HEIGHT',
            fills: solid(0.08)
          })
        }
        await store.loadFontsForNodes(store.graph.getChildren(pageId).map((node) => node.id))
      },
      { samples: SAMPLES, top: ROW_TOP, pitch: ROW_PITCH }
    )
  }

  async function reopenWithoutFont(bytes: number[]): Promise<number> {
    return page().evaluate(
      async ({ saved, family }) => {
        const store = window.openPencil?.getStore?.()
        if (!store) throw new Error('Editor unavailable')
        await store.openFigFile(new File([new Uint8Array(saved)], 'Saved glyphs.fig'))
        const texts = [...store.graph.nodes.values()].filter((node) => node.type === 'TEXT')
        for (const node of texts) {
          if (!node.derivedTextGlyphs?.length) throw new Error(`${node.name} has no saved glyphs`)
          store.graph.updateNode(node.id, {
            fontFamily: family,
            derivedTextGlyphs: node.derivedTextGlyphs
          })
        }
        store.clearSelection()
        store.requestRender()
        return texts.filter(
          (node) => node.fontFamily === family && (node.derivedTextGlyphs?.length ?? 0) > 0
        ).length
      },
      { saved: bytes, family: UNAVAILABLE_FAMILY }
    )
  }

  return {
    samples: SAMPLES.length,

    async show(): Promise<number> {
      await createLiveText()
      return reopenWithoutFont(await savedFigBytes())
    },

    edgeShares(png: Uint8Array, zoom: number): Promise<number[]> {
      return page().evaluate(
        async ({ base64, zoom, rows, top, pitch }) => {
          const blob = await (await fetch(`data:image/png;base64,${base64}`)).blob()
          const bitmap = await createImageBitmap(blob)
          const surface = new OffscreenCanvas(bitmap.width, bitmap.height)
          const context = surface.getContext('2d')
          if (!context) throw new Error('2D context unavailable')
          context.drawImage(bitmap, 0, 0)
          const { data, width } = context.getImageData(0, 0, bitmap.width, bitmap.height)
          return Array.from({ length: rows }, (_, row) => {
            let ink = 0
            let partial = 0
            const from = Math.round((top + row * pitch) * zoom)
            const to = Math.round((top + row * pitch + pitch * 0.75) * zoom)
            for (let y = from; y < to; y++) {
              for (let x = 0; x < width; x++) {
                const value = data[(y * width + x) * 4]
                if (value < 230) {
                  ink++
                }
                if (value > 40 && value < 230) {
                  partial++
                }
              }
            }
            return ink === 0 ? 0 : partial / ink
          })
        },
        { base64: fromUint8Array(png), zoom, rows: SAMPLES.length, top: ROW_TOP, pitch: ROW_PITCH }
      )
    },

    async capture(zoom: number, width: number, height: number) {
      await page().evaluate((scale) => {
        const store = window.openPencil?.getStore?.()
        if (!store) throw new Error('Editor unavailable')
        store.setZoomAroundPoint(1, 0, 0)
        store.pan(-store.state.panX, -store.state.panY)
        store.setZoomAroundPoint(scale, 0, 0)
        store.requestRender()
      }, zoom)
      await settle()
      return canvas().screenshotCanvasRegion(width, height)
    }
  }
}
