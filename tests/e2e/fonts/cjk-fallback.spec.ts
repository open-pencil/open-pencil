import { test, expect } from '@playwright/test'

import { CanvasHelper } from '#tests/helpers/canvas'

test('CJK fallback fonts load only after CJK text is added', async ({ page }) => {
  const canvas = new CanvasHelper(page)
  await page.goto('http://localhost:1420/?test&no-chrome&no-rulers')
  await canvas.waitForInit()

  const result = await page.evaluate(async () => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    const renderer = store.renderer
    if (!renderer) throw new Error('OpenPencil renderer not initialized')

    const [{ fontManager }, { ensureGraphFonts }] = await Promise.all([
      import('/packages/core/src/text/fonts.ts'),
      import('/src/app/editor/fonts/index.ts')
    ])
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

    manager.cjkFallbackFamilies = []
    manager.cjkFallbackPromise = null
    manager.arabicFallbackFamilies = []
    manager.arabicFallbackPromise = null

    let ensureCJKFallbackCalls = 0
    fontManager.ensureCJKFallback = async () => {
      ensureCJKFallbackCalls += 1
      fontManager.setCJKFallbackFamily('Regression CJK Fallback')
      return ['Regression CJK Fallback']
    }
    fontManager.ensureArabicFallback = async () => []

    const pageNode = store.graph.getNode(store.state.currentPageId)
    if (!pageNode) throw new Error(`Page ${store.state.currentPageId} not found`)

    try {
      await renderer.loadFonts()
      const fallbackCountAfterStartup = ensureCJKFallbackCalls

      const latinText = store.graph.createNode('TEXT', pageNode.id, {
        name: 'Latin Regression',
        x: 80,
        y: 80,
        width: 300,
        height: 60,
        text: 'OpenPencil text',
        fontSize: 32,
        fontFamily: 'Inter',
        fills: [{ type: 'SOLID', color: { r: 0, g: 0, b: 0, a: 1 }, visible: true, opacity: 1 }]
      })
      await ensureGraphFonts(store.graph, [latinText.id])
      const fallbackCountAfterLatin = ensureCJKFallbackCalls

      const cjkText = store.graph.createNode('TEXT', pageNode.id, {
        name: 'CJK Regression',
        x: 80,
        y: 150,
        width: 420,
        height: 70,
        text: '中文字体回退测试',
        fontSize: 32,
        fontFamily: 'Inter',
        fills: [{ type: 'SOLID', color: { r: 0, g: 0, b: 0, a: 1 }, visible: true, opacity: 1 }]
      })
      const loaded = await ensureGraphFonts(store.graph, [cjkText.id])

      return {
        loaded,
        fallbackCountAfterStartup,
        fallbackCountAfterLatin,
        fallbackCountAfterCJK: ensureCJKFallbackCalls,
        loadedAfterFallback: renderer.isNodeFontLoaded(cjkText)
      }
    } finally {
      manager.cjkFallbackFamilies = originalCJKFamilies
      manager.cjkFallbackPromise = originalCJKPromise
      manager.arabicFallbackFamilies = originalArabicFamilies
      manager.arabicFallbackPromise = originalArabicPromise
      fontManager.ensureCJKFallback = originalEnsureCJKFallback
      fontManager.ensureArabicFallback = originalEnsureArabicFallback
    }
  })

  expect(result.fallbackCountAfterStartup).toBe(0)
  expect(result.fallbackCountAfterLatin).toBe(0)
  expect(result.fallbackCountAfterCJK).toBe(1)
  expect(result.loaded).toBe(true)
  expect(result.loadedAfterFallback).toBe(true)
  canvas.assertNoErrors()
})
