import { test, expect } from '@playwright/test'

import type { FontManager } from '#core/text/fonts'

import { CanvasHelper } from '#tests/helpers/canvas'

test('tool-created CJK text requests fallback through app font loading', async ({ page }) => {
  const canvas = new CanvasHelper(page)
  await page.goto('http://localhost:1420/?test&no-chrome&no-rulers')
  await canvas.waitForInit()

  const result = await page.evaluate(async () => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')

    const { ensureGraphFonts, loadFont } = await import('/src/app/editor/fonts/index.ts')
    await loadFont('Inter', 'Regular')
    const fontModuleUrl = performance
      .getEntriesByType('resource')
      .map((entry) => entry.name)
      .find((url) => url.includes('/packages/core/src/text/fonts.ts'))
    if (!fontModuleUrl) throw new Error('Active font manager module not found')
    const { fontManager } = (await import(/* @vite-ignore */ fontModuleUrl)) as {
      fontManager: FontManager
    }
    const originalEnsureFallbackPack = fontManager.ensureFallbackPack.bind(fontManager)
    let requestedScripts: string[] = []

    fontManager.ensureFallbackPack = async (scripts = ['cjk', 'arabic']) => {
      requestedScripts = [...scripts]
      return { cjk: ['Noto Sans CJK SC'], arabic: [] }
    }

    const pageNode = store.graph.getNode(store.state.currentPageId)
    if (!pageNode) throw new Error(`Page ${store.state.currentPageId} not found`)
    const text = store.graph.createNode('TEXT', pageNode.id, {
      name: 'Tool CJK Regression',
      x: 80,
      y: 80,
      width: 300,
      height: 60,
      text: '你好世界',
      fontSize: 32,
      fontFamily: 'Inter',
      textPicture: new Uint8Array([1, 2, 3]),
      fills: [{ type: 'SOLID', color: { r: 0, g: 0, b: 0, a: 1 }, visible: true, opacity: 1 }]
    })

    try {
      const changed = await ensureGraphFonts(store.graph, [text.id])
      return {
        changed,
        requestedScripts,
        textPictureCleared: store.graph.getNode(text.id)?.textPicture === null
      }
    } finally {
      fontManager.ensureFallbackPack = originalEnsureFallbackPack
    }
  })

  expect(result).toEqual({
    changed: true,
    requestedScripts: ['cjk-sc'],
    textPictureCleared: true
  })
  canvas.assertNoErrors()
})

test('CJK text waits for fallback fonts and repaints after they load', async ({ page }) => {
  const canvas = new CanvasHelper(page)
  await page.goto('http://localhost:1420/?test&no-chrome&no-rulers')
  await canvas.waitForInit()

  const result = await page.evaluate(async () => {
    const store = window.openPencil?.getStore?.()
    if (!store?.renderer) throw new Error('OpenPencil renderer not initialized')
    const renderer = store.renderer
    const response = await fetch('/tests/fixtures/fonts/NotoSansCJK-Test.otf')
    const fallbackData = await response.arrayBuffer()
    const fontModuleUrl = performance
      .getEntriesByType('resource')
      .map((entry) => entry.name)
      .find((url) => url.includes('/packages/core/src/text/fonts.ts'))
    if (!fontModuleUrl) throw new Error('Active font manager module not found')
    const { fontManager } = (await import(/* @vite-ignore */ fontModuleUrl)) as {
      fontManager: FontManager
    }
    const manager = fontManager as typeof fontManager & { cjkFallbackFamilies: string[] }
    const originalFamilies = [...manager.cjkFallbackFamilies]
    const originalEnsureFallbackPack = fontManager.ensureFallbackPack.bind(fontManager)

    let releaseFallback = () => undefined
    const fallbackGate = new Promise<void>((resolve) => {
      releaseFallback = resolve
    })
    manager.cjkFallbackFamilies = []

    let fallbackRenderCount = 0
    let renderCount = 0
    const originalRender = renderer.renderFromEditorState.bind(renderer)
    fontManager.ensureFallbackPack = async (scripts = ['cjk', 'arabic']) => {
      await fallbackGate
      fontManager.markLoaded('Noto Sans CJK SC', 'Regular', fallbackData)
      fontManager.setCJKFallbackFamily('Noto Sans CJK SC')
      return Object.fromEntries(scripts.map((script) => [script, ['Noto Sans CJK SC']]))
    }
    renderer.renderFromEditorState = (
      ...args: Parameters<typeof renderer.renderFromEditorState>
    ) => {
      renderCount += 1
      return originalRender(...args)
    }

    const text = store.graph.createNode('TEXT', store.state.currentPageId, {
      name: 'CJK Regression',
      x: 80,
      y: 80,
      width: 300,
      height: 60,
      text: '你好世界App',
      textLanguage: 'zh-Hans',
      fontSize: 32,
      fontFamily: 'Inter',
      fills: [{ type: 'SOLID', color: { r: 0, g: 0, b: 0, a: 1 }, visible: true, opacity: 1 }]
    })

    try {
      await renderer.loadFonts(() => {
        fallbackRenderCount += 1
        renderer.renderFromEditorState(
          store.state,
          store.graph,
          store.textEditor,
          800,
          600,
          false,
          'full'
        )
      })
      const loadedBeforeFallback = renderer.isNodeFontLoaded(text)
      releaseFallback()
      await fallbackGate
      await new Promise<void>((resolve) => {
        setTimeout(resolve, 0)
      })
      await new Promise(requestAnimationFrame)
      return {
        loadedBeforeFallback,
        loadedAfterFallback: renderer.isNodeFontLoaded(text),
        readiness: renderer.nodeFontReadiness(text),
        fallbackRenderCount,
        renderCount
      }
    } finally {
      manager.cjkFallbackFamilies = originalFamilies
      fontManager.ensureFallbackPack = originalEnsureFallbackPack
      renderer.renderFromEditorState = originalRender
    }
  })

  expect(result.loadedBeforeFallback).toBe(false)
  expect(result.readiness).toBe('ready')
  expect(result.loadedAfterFallback).toBe(true)
  expect(result.fallbackRenderCount).toBe(1)
  expect(result.renderCount).toBeGreaterThan(0)
  canvas.assertNoErrors()
})
