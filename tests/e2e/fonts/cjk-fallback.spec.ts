import { test, expect } from '@playwright/test'

import { CanvasHelper } from '#tests/helpers/canvas'

test('CJK text waits for fallback fonts and repaints after they load', async ({ page }) => {
  const canvas = new CanvasHelper(page)
  await page.goto('http://localhost:1420/?test&no-chrome')
  await canvas.waitForInit()

  const result = await page.evaluate(async () => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    const renderer = store.renderer
    if (!renderer) throw new Error('OpenPencil renderer not initialized')

    const { fontManager } = await import('/packages/core/src/text/fonts.ts')
    const manager = fontManager as typeof fontManager & {
      cjkFallbackFamilies: string[]
      cjkFallbackPromise: Promise<string[]> | null
      arabicFallbackFamilies: string[]
      arabicFallbackPromise: Promise<string[]> | null
    }
    const originalCJKFamilies = [...manager.cjkFallbackFamilies]
    const originalCJKPromise = manager.cjkFallbackPromise
    const originalArabicFamilies = [...manager.arabicFallbackFamilies]
    const originalArabicPromise = manager.arabicFallbackPromise
    const originalEnsureCJKFallback = fontManager.ensureCJKFallback.bind(fontManager)
    const originalEnsureArabicFallback = fontManager.ensureArabicFallback.bind(fontManager)

    let releaseCJKFallback: (() => void) | null = null
    const fallbackGate = new Promise<void>((resolve) => {
      releaseCJKFallback = resolve
    })

    manager.cjkFallbackFamilies = []
    manager.cjkFallbackPromise = null
    manager.arabicFallbackFamilies = []
    manager.arabicFallbackPromise = null

    let fallbackRenderCount = 0
    let renderCount = 0
    const originalRender = renderer.renderFromEditorState.bind(renderer)

    fontManager.ensureCJKFallback = async () => {
      await fallbackGate
      fontManager.setCJKFallbackFamily('Regression CJK Fallback')
      return ['Regression CJK Fallback']
    }
    fontManager.ensureArabicFallback = async () => []
    renderer.renderFromEditorState = (
      ...args: Parameters<typeof renderer.renderFromEditorState>
    ) => {
      renderCount += 1
      return originalRender(...args)
    }

    const pageNode = store.graph.getNode(store.state.currentPageId)
    if (!pageNode) throw new Error(`Page ${store.state.currentPageId} not found`)
    const text = store.graph.createNode('TEXT', pageNode.id, {
      name: 'CJK Regression',
      x: 80,
      y: 80,
      width: 300,
      height: 60,
      text: '上班打卡App',
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
      const beforeFallbackRenderCount = fallbackRenderCount

      releaseCJKFallback?.()
      await new Promise((resolve) => setTimeout(resolve, 0))
      await new Promise(requestAnimationFrame)

      return {
        loadedBeforeFallback,
        loadedAfterFallback: renderer.isNodeFontLoaded(text),
        beforeFallbackRenderCount,
        fallbackRenderCount,
        renderCount
      }
    } finally {
      manager.cjkFallbackFamilies = originalCJKFamilies
      manager.cjkFallbackPromise = originalCJKPromise
      manager.arabicFallbackFamilies = originalArabicFamilies
      manager.arabicFallbackPromise = originalArabicPromise
      fontManager.ensureCJKFallback = originalEnsureCJKFallback
      fontManager.ensureArabicFallback = originalEnsureArabicFallback
      renderer.renderFromEditorState = originalRender
    }
  })

  expect(result.loadedBeforeFallback).toBe(false)
  expect(result.loadedAfterFallback).toBe(true)
  expect(result.beforeFallbackRenderCount).toBe(0)
  expect(result.fallbackRenderCount).toBe(1)
  expect(result.renderCount).toBeGreaterThan(0)
  canvas.assertNoErrors()
})
