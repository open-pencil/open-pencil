import { readFile } from 'node:fs/promises'

import type { Page } from '@playwright/test'
import { fromUint8Array } from 'js-base64'

import { expectDefined } from '@open-pencil/test-support/assert'

import { CanvasHelper } from '#tests/helpers/canvas'
import { pageScene, showView } from '#tests/helpers/canvas/page-scene'
import {
  SAVED_GLYPH_ROW_PITCH,
  SAVED_GLYPH_ROW_TOP,
  SAVED_GLYPH_SAMPLES
} from '#tests/helpers/canvas/saved-glyph-antialias/scene'
import type * as SavedGlyphScenes from '#tests/helpers/canvas/saved-glyph-antialias/scene'

const UNAVAILABLE_FAMILY = 'Repro Unavailable Sans'

export function savedGlyphAntialiasDriver(page: () => Page) {
  const canvas = () => new CanvasHelper(page())
  const scenes = pageScene<typeof SavedGlyphScenes>(
    page,
    '/tests/helpers/canvas/saved-glyph-antialias/scene.ts'
  )

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
    const layers = await scenes.build('createSavedGlyphScene')
    await page().evaluate(async (ids) => {
      await window.openPencil?.getStore?.().loadFontsForNodes(ids)
    }, layers)
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
    samples: SAVED_GLYPH_SAMPLES.length,

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
        {
          base64: fromUint8Array(png),
          zoom,
          rows: SAVED_GLYPH_SAMPLES.length,
          top: SAVED_GLYPH_ROW_TOP,
          pitch: SAVED_GLYPH_ROW_PITCH
        }
      )
    },

    async capture(zoom: number, width: number, height: number) {
      await showView(page(), { zoom, panX: 0, panY: 0 })
      await settle()
      return canvas().screenshotCanvasRegion(width, height)
    }
  }
}
