import { Buffer } from 'node:buffer'

import type { Page } from '@playwright/test'

import type { FontManager } from '#core/text/fonts'

import { expect, test } from '#tests/e2e/fixtures'
import { CanvasHelper } from '#tests/helpers/canvas'

async function openEditor(page: Page): Promise<CanvasHelper> {
  await page.goto('/?test&no-chrome&no-rulers')
  const canvas = new CanvasHelper(page)
  await canvas.waitForInit()
  await page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    const pageNode = store.graph.getNode(store.state.currentPageId)
    const childIds = pageNode?.childIds.slice() ?? []
    for (const id of childIds) store.graph.deleteNode(id)
    store.clearSelection()
    store.renderer?.invalidateAllPictures()
    store.requestRender()
    store.renderer?.renderFromEditorState(
      store.state,
      store.graph,
      store.textEditor,
      window.innerWidth,
      window.innerHeight,
      false,
      'full'
    )
  })
  await canvas.waitForRender()
  return canvas
}

async function expectCanvas(canvas: CanvasHelper, name: string): Promise<void> {
  await canvas.page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(resolve))
      })
  )
  canvas.assertNoErrors()
  expect(await canvas.canvas.screenshot()).toMatchSnapshot(`${name}.png`)
}

test('international text is correct on its first visible paint', async ({ page }) => {
  await openEditor(page)

  const result = await page.evaluate(async () => {
    const store = window.openPencil?.getStore?.()
    if (!store?.renderer) throw new Error('OpenPencil renderer not initialized')
    const fontModuleUrl = performance
      .getEntriesByType('resource')
      .map((entry) => entry.name)
      .find((url) => url.includes('/packages/core/src/text/fonts.ts'))
    if (!fontModuleUrl) throw new Error('Active font manager module not found')
    const { fontManager } = (await import(/* @vite-ignore */ fontModuleUrl)) as {
      fontManager: FontManager
    }
    const pageId = store.state.currentPageId
    const samples = [
      {
        label: 'Simplified Chinese',
        text: '你好世界',
        language: 'zh-Hans',
        family: 'Noto Sans CJK SC'
      },
      {
        label: 'Traditional Chinese',
        text: '繁體中文',
        language: 'zh-Hant',
        family: 'Noto Sans CJK SC'
      },
      { label: 'Japanese', text: '日本語かなカナ', language: 'ja', family: 'Noto Sans CJK SC' },
      { label: 'Korean', text: '안녕하세요', language: 'ko', family: 'Noto Sans CJK SC' },
      { label: 'Arabic', text: 'مرحبا بالعالم', language: 'ar', family: 'Noto Naskh Arabic' },
      {
        label: 'Mixed scripts',
        text: 'OpenPencil · 你好 · مرحبا',
        language: 'en',
        family: 'Noto Sans CJK SC'
      }
    ]

    const sampleIds = samples.map((sample, index) => {
      const y = 70 + index * 62
      store.graph.createNode('TEXT', pageId, {
        name: `${sample.label} label`,
        x: 88,
        y: y + 4,
        width: 220,
        height: 28,
        text: sample.label,
        fontFamily: 'Inter',
        fontSize: 16,
        fontWeight: 600,
        fills: [
          { type: 'SOLID', color: { r: 0.25, g: 0.32, b: 0.45, a: 1 }, visible: true, opacity: 1 }
        ]
      })
      return store.graph.createNode('TEXT', pageId, {
        name: `${sample.label} sample`,
        x: 330,
        y,
        width: 430,
        height: 44,
        text: sample.text,
        textLanguage: sample.language,
        fontFamily: sample.family,
        fontSize: 30,
        textAutoResize: 'NONE',
        styleRuns:
          sample.label === 'Mixed scripts'
            ? [
                {
                  start: sample.text.indexOf('مرحبا'),
                  length: 'مرحبا'.length,
                  style: { fontFamily: 'Noto Naskh Arabic', textLanguage: 'ar' }
                }
              ]
            : [],
        fills: [
          { type: 'SOLID', color: { r: 0.04, g: 0.06, b: 0.12, a: 1 }, visible: true, opacity: 1 }
        ]
      }).id
    })

    fontManager.blockNodesUntilFontsResolve(sampleIds)
    const blockedBeforeFonts = sampleIds.every((id) => fontManager.isNodeBlocked(id))
    const [cjk, arabic] = await Promise.all([
      fetch('/tests/fixtures/fonts/NotoSansCJK-Test.otf').then((response) =>
        response.arrayBuffer()
      ),
      fetch('/tests/fixtures/fonts/NotoNaskhArabic-Regular.ttf').then((response) =>
        response.arrayBuffer()
      )
    ])
    fontManager.markLoaded('Noto Sans CJK SC', 'Regular', cjk)
    fontManager.markLoaded('Noto Naskh Arabic', 'Regular', arabic)
    fontManager.setCJKFallbackFamily('Noto Sans CJK SC')
    fontManager.setArabicFallbackFamily('Noto Naskh Arabic')

    await store.loadFontsForNodes(sampleIds)
    fontManager.unblockNodes(sampleIds)
    for (const id of sampleIds) {
      const node = store.graph.getNode(id)
      if (node?.type === 'TEXT') store.graph.updateNode(id, { text: node.text })
    }
    store.clearSelection()
    store.renderer.invalidateAllPictures()
    store.requestRender()
    store.renderer.renderFromEditorState(
      store.state,
      store.graph,
      store.textEditor,
      window.innerWidth,
      window.innerHeight,
      false,
      'full'
    )
    const pageNode = store.graph.getNode(pageId)
    const image = await store.renderExportImage(pageNode?.childIds ?? [], 2, 'PNG')
    if (!image) throw new Error('First-paint export failed')
    return {
      blockedBeforeFonts,
      image: Array.from(image),
      readiness: sampleIds.map((id) => {
        const node = store.graph.getNode(id)
        return {
          name: node?.name,
          state: node ? store.renderer?.nodeFontReadiness(node) : 'missing'
        }
      }),
      unblockedAfterFonts: sampleIds.every((id) => !fontManager.isNodeBlocked(id))
    }
  })

  const { image, ...state } = result
  expect(state).toEqual({
    blockedBeforeFonts: true,
    readiness: [
      { name: 'Simplified Chinese sample', state: 'ready' },
      { name: 'Traditional Chinese sample', state: 'ready' },
      { name: 'Japanese sample', state: 'ready' },
      { name: 'Korean sample', state: 'ready' },
      { name: 'Arabic sample', state: 'ready' },
      { name: 'Mixed scripts sample', state: 'ready' }
    ],
    unblockedAfterFonts: true
  })
  expect(Buffer.from(image)).toMatchSnapshot('international-text-first-paint.png')
})

test('typed and tool-created text repaint with the same resolved fallbacks', async ({ page }) => {
  const canvas = await openEditor(page)

  const ids = await page.evaluate(async () => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    const pageId = store.state.currentPageId

    const labels = ['Tool-created', 'Interactively typed']
    for (const [index, label] of labels.entries()) {
      store.graph.createNode('TEXT', pageId, {
        name: `${label} label`,
        x: 88,
        y: 112 + index * 92,
        width: 190,
        height: 28,
        text: label,
        fontFamily: 'Inter',
        fontSize: 16,
        fontWeight: 600,
        fills: [
          { type: 'SOLID', color: { r: 0.25, g: 0.32, b: 0.45, a: 1 }, visible: true, opacity: 1 }
        ]
      })
    }

    const common = {
      width: 450,
      height: 52,
      textLanguage: 'zh-Hans',
      fontFamily: 'Inter',
      fontSize: 30,
      textAutoResize: 'NONE' as const,
      fills: [
        {
          type: 'SOLID' as const,
          color: { r: 0.04, g: 0.06, b: 0.12, a: 1 },
          visible: true,
          opacity: 1
        }
      ]
    }
    const tool = store.graph.createNode('TEXT', pageId, {
      ...common,
      name: 'Tool-created mixed script',
      x: 300,
      y: 104,
      text: 'OpenPencil · 你好 · مرحبا'
    })
    const typed = store.graph.createNode('TEXT', pageId, {
      ...common,
      name: 'Interactively typed mixed script',
      x: 300,
      y: 196,
      text: ''
    })
    const nodeIds = [tool.id, typed.id]
    const fontModuleUrl = performance
      .getEntriesByType('resource')
      .map((entry) => entry.name)
      .find((url) => url.includes('/packages/core/src/text/fonts.ts'))
    if (!fontModuleUrl) throw new Error('Active font manager module not found')
    const { fontManager } = (await import(/* @vite-ignore */ fontModuleUrl)) as {
      fontManager: FontManager
    }
    fontManager.blockNodesUntilFontsResolve(nodeIds)
    store.select([typed.id])
    store.startTextEditing(typed.id)
    store.requestRender()
    return { nodeIds, toolId: tool.id, typedId: typed.id }
  })

  await page.locator('textarea[aria-hidden="true"]').fill('OpenPencil · 你好 · مرحبا')
  await page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store?.renderer) throw new Error('OpenPencil renderer not initialized')
    store.renderer.invalidateAllPictures()
    store.renderer.renderFromEditorState(
      store.state,
      store.graph,
      store.textEditor,
      window.innerWidth,
      window.innerHeight,
      false,
      'full'
    )
  })
  await canvas.waitForRender()
  const pending = await page.evaluate(async (nodeIds) => {
    const fontModuleUrl = performance
      .getEntriesByType('resource')
      .map((entry) => entry.name)
      .find((url) => url.includes('/packages/core/src/text/fonts.ts'))
    if (!fontModuleUrl) throw new Error('Active font manager module not found')
    const { fontManager } = (await import(/* @vite-ignore */ fontModuleUrl)) as {
      fontManager: FontManager
    }
    return nodeIds.every((id) => fontManager.isNodeBlocked(id))
  }, ids.nodeIds)
  expect(pending).toBe(true)
  await expectCanvas(canvas, 'interactive-font-fallback-pending')

  const resolved = await page.evaluate(async ({ nodeIds, toolId, typedId }) => {
    const store = window.openPencil?.getStore?.()
    if (!store?.renderer) throw new Error('OpenPencil renderer not initialized')
    const fontModuleUrl = performance
      .getEntriesByType('resource')
      .map((entry) => entry.name)
      .find((url) => url.includes('/packages/core/src/text/fonts.ts'))
    if (!fontModuleUrl) throw new Error('Active font manager module not found')
    const { fontManager } = (await import(/* @vite-ignore */ fontModuleUrl)) as {
      fontManager: FontManager
    }
    const [cjk, arabic] = await Promise.all([
      fetch('/tests/fixtures/fonts/NotoSansCJK-Test.otf').then((response) =>
        response.arrayBuffer()
      ),
      fetch('/tests/fixtures/fonts/NotoNaskhArabic-Regular.ttf').then((response) =>
        response.arrayBuffer()
      )
    ])
    fontManager.markLoaded('Noto Sans CJK SC', 'Regular', cjk)
    fontManager.markLoaded('Noto Naskh Arabic', 'Regular', arabic)
    fontManager.setCJKFallbackFamily('Noto Sans CJK SC')
    fontManager.setArabicFallbackFamily('Noto Naskh Arabic')
    store.commitTextEdit()
    await store.loadFontsForNodes(nodeIds)
    fontManager.unblockNodes(nodeIds)
    for (const id of nodeIds) {
      const node = store.graph.getNode(id)
      if (node?.type === 'TEXT') store.graph.updateNode(id, { text: node.text })
    }
    store.clearSelection()
    store.renderer.invalidateAllPictures()
    store.requestRender()
    store.renderer.renderFromEditorState(
      store.state,
      store.graph,
      store.textEditor,
      window.innerWidth,
      window.innerHeight,
      false,
      'full'
    )

    const tool = store.graph.getNode(toolId)
    const typed = store.graph.getNode(typedId)
    const pageNode = store.graph.getNode(store.state.currentPageId)
    const image = await store.renderExportImage(pageNode?.childIds ?? [], 2, 'PNG')
    if (!image) throw new Error('Interactive export failed')
    return {
      image: Array.from(image),
      textsMatch: tool?.type === 'TEXT' && typed?.type === 'TEXT' && tool.text === typed.text,
      toolReady: tool ? store.renderer.isNodeFontLoaded(tool) : false,
      typedReady: typed ? store.renderer.isNodeFontLoaded(typed) : false,
      unblocked: nodeIds.every((id) => !fontManager.isNodeBlocked(id))
    }
  }, ids)

  const { image, ...state } = resolved
  expect(state).toEqual({ textsMatch: true, toolReady: true, typedReady: true, unblocked: true })
  expect(Buffer.from(image)).toMatchSnapshot('interactive-font-fallback-resolved.png')
})
