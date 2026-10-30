import { readFile } from 'node:fs/promises'

import type { Page } from '@playwright/test'

export async function createWrappedText(page: Page, message: string) {
  await page.evaluate((message) => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('Editor unavailable')
    const card = store.graph.createNode('FRAME', store.state.currentPageId, {
      name: 'Card',
      width: 260,
      height: 52,
      fills: [{ type: 'SOLID', color: { r: 1, g: 1, b: 1, a: 1 }, visible: true, opacity: 1 }]
    })
    store.graph.createNode('TEXT', card.id, {
      name: 'Message',
      text: message,
      x: 10,
      y: 10,
      width: 230,
      height: 32,
      fontFamily: 'Inter',
      fontSize: 13,
      lineHeight: { value: 16, unit: 'PIXELS' },
      textAutoResize: 'HEIGHT',
      fills: [{ type: 'SOLID', color: { r: 0.1, g: 0.1, b: 0.1, a: 1 }, visible: true, opacity: 1 }]
    })
  }, message)
}

export async function saveAsAndReopenWrappedText(page: Page) {
  const picker = await page.evaluateHandle(() => {
    const original = window.showSaveFilePicker
    window.showSaveFilePicker = undefined
    return {
      restore: () => {
        window.showSaveFilePicker = original
      }
    }
  })
  let bytes: number[]
  try {
    page.once('dialog', (dialog) => dialog.accept('Card.fig'))
    const download = page.waitForEvent('download')
    await page.evaluate(() => {
      const store = window.openPencil?.getStore?.()
      if (!store) throw new Error('Editor unavailable')
      return store.saveFigFileAs()
    })
    bytes = [...(await readFile(await (await download).path()))]
  } finally {
    await picker.evaluate((handle) => handle.restore())
    await picker.dispose()
  }
  await page.evaluate(async (saved) => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('Editor unavailable')
    await store.openFigFile(new File([new Uint8Array(saved)], 'Card.fig'))
    store.requestRender()
  }, bytes)
}

export async function readWrappedTextLineCount(page: Page) {
  return page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('Editor unavailable')
    const message = [...store.graph.nodes.values()].find((node) => node.name === 'Message')
    if (!message) throw new Error('Wrapped text unavailable')
    return new Set(message.derivedTextGlyphs?.map((glyph) => glyph.y)).size
  })
}

export async function createFallbackText(page: Page) {
  return page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('Editor unavailable')
    const frame = store.graph.createNode('FRAME', store.state.currentPageId, {
      name: 'Font file regression',
      width: 320,
      height: 100,
      fills: [{ type: 'SOLID', color: { r: 1, g: 1, b: 1, a: 1 }, visible: true, opacity: 1 }]
    })
    const sample = store.graph.createNode('TEXT', frame.id, {
      name: 'Fallback sample',
      text: 'Missing',
      x: 20,
      y: 20,
      width: 280,
      height: 60,
      fontFamily: 'Saved Text Primary',
      fontWeight: 700,
      fontSize: 40,
      textAutoResize: 'NONE',
      fills: [{ type: 'SOLID', color: { r: 0, g: 0, b: 0, a: 1 }, visible: true, opacity: 1 }]
    })
    return sample.id
  })
}

export async function saveCopyAndReopenFallbackText(page: Page) {
  await page.evaluate(async () => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('Editor unavailable')
    let saved: Uint8Array | undefined
    await store.saveFigFileCopy(async (bytes) => {
      saved = bytes
    })
    if (!saved) throw new Error('Save did not produce a file')
    await store.openFigFile(new File([new Uint8Array(saved)], 'Fallback.fig'))
    store.centerOn(160, 50, 1)
    store.requestRender()
  })
}

export async function readFallbackText(page: Page, id: string) {
  return page.evaluate((id) => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('Editor unavailable')
    const reopened = store.graph.getNode(id)
    if (!reopened) throw new Error('Fallback text unavailable')
    return { text: reopened.text, glyphs: reopened.derivedTextGlyphs?.length }
  }, id)
}
