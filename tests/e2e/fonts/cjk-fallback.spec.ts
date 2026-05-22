import { test, expect } from '@playwright/test'

import { CanvasHelper } from '#tests/helpers/canvas'

test('CJK text triggers lazy fallback font loading and repaints after they load', async ({
  page
}) => {
  const canvas = new CanvasHelper(page)
  await page.goto('/?test&no-chrome&no-rulers')
  await canvas.waitForInit()

  const result = await page.evaluate(async () => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    const renderer = store.renderer
    if (!renderer) throw new Error('OpenPencil renderer not initialized')
    const getFontManager = window.openPencil?.getFontManager
    if (!getFontManager) throw new Error('getFontManager not exposed on window.openPencil')
    const fontManager = getFontManager()
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

    let repaintCount = 0
    const originalRequestRepaint = renderer.requestRepaint
    renderer.requestRepaint = () => {
      repaintCount += 1
      if (typeof originalRequestRepaint === 'function') {
        originalRequestRepaint.call(renderer)
      }
    }

    fontManager.ensureCJKFallback = async () => {
      await fallbackGate
      fontManager.setCJKFallbackFamily('Regression CJK Fallback')
      return ['Regression CJK Fallback']
    }
    fontManager.ensureArabicFallback = async () => []

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
      // Load primary fonts (no callback — lazy fallback via requestFallbackFamiliesIfNeeded)
      await renderer.loadFonts()

      // Trigger a render — this calls buildParagraph which calls
      // requestFallbackFamiliesIfNeeded, starting the lazy fallback request
      renderer.renderFromEditorState(
        store.state,
        store.graph,
        store.textEditor,
        800,
        600,
        false,
        'full'
      )

      const loadedBeforeFallback = renderer.isNodeFontLoaded(text)
      const repaintBeforeFallback = repaintCount

      // Release the gated fallback — ensureCJKFallback resolves
      releaseCJKFallback?.()
      // Wait for the async fallback chain to complete:
      // ensureCJKFallback resolves → setCJKFallbackFamily → requestRepaint
      await new Promise((resolve) => {
        setTimeout(() => resolve(), 50)
      })
      await new Promise(requestAnimationFrame)

      // After the fallback family name is registered, isNodeFontLoaded
      // should return true (it only checks family name presence, not data)
      return {
        loadedBeforeFallback,
        loadedAfterFallback: renderer.isNodeFontLoaded(text),
        repaintBeforeFallback,
        repaintCount,
        repaintTriggered: repaintCount > repaintBeforeFallback
      }
    } finally {
      manager.cjkFallbackFamilies = originalCJKFamilies
      manager.cjkFallbackPromise = originalCJKPromise
      manager.arabicFallbackFamilies = originalArabicFamilies
      manager.arabicFallbackPromise = originalArabicPromise
      fontManager.ensureCJKFallback = originalEnsureCJKFallback
      fontManager.ensureArabicFallback = originalEnsureArabicFallback
      renderer.requestRepaint = originalRequestRepaint
    }
  })

  expect(result.loadedBeforeFallback).toBe(false)
  expect(result.loadedAfterFallback).toBe(true)
  expect(result.repaintTriggered).toBe(true)
  canvas.assertNoErrors()
})
