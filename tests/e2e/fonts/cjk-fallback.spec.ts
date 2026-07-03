import { test, expect } from '@playwright/test'

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
    const { fontManager } = await import('/packages/core/src/text/fonts.ts')
    const originalEnsureFallbackPack = fontManager.ensureFallbackPack.bind(fontManager)
    let requestedScripts: string[] = []

    fontManager.ensureFallbackPack = async (scripts = ['cjk', 'arabic']) => {
      requestedScripts = [...scripts]
      return { 'cjk-sc': ['Regression CJK Fallback'], arabic: [] }
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

test('CJK text renders after generic CJK repaint while script packs remain strict', async ({
  page
}) => {
  const canvas = new CanvasHelper(page)
  await page.goto('http://localhost:1420/?test&no-chrome&no-rulers')
  await canvas.waitForInit()

  const result = await page.evaluate(async () => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    const renderer = store.renderer
    if (!renderer) throw new Error('OpenPencil renderer not initialized')

    const { fontManager } = await import('/packages/core/src/text/fonts.ts')
    const manager = fontManager as typeof fontManager & {
      cjkFallbackFamilies: Map<string, string[]>
      cjkFallbackPromises: Map<string, Promise<string[]>>
      arabicFallbackFamilies: string[]
      arabicFallbackPromise: Promise<string[]> | null
    }
    const originalCJKFamilies = new Map(
      [...manager.cjkFallbackFamilies].map(([script, families]) => [script, [...families]])
    )
    const originalCJKPromises = new Map(manager.cjkFallbackPromises)
    const originalArabicFamilies = [...manager.arabicFallbackFamilies]
    const originalArabicPromise = manager.arabicFallbackPromise
    const originalEnsureCJKFallback = fontManager.ensureCJKFallback.bind(fontManager)
    const originalEnsureArabicFallback = fontManager.ensureArabicFallback.bind(fontManager)

    let releaseGenericCJKFallback: (() => void) | null = null
    const genericFallbackGate = new Promise<void>((resolve) => {
      releaseGenericCJKFallback = resolve
    })
    let releaseSimplifiedCJKFallback: (() => void) | null = null
    const simplifiedFallbackGate = new Promise<void>((resolve) => {
      releaseSimplifiedCJKFallback = resolve
    })

    manager.cjkFallbackFamilies.clear()
    manager.cjkFallbackPromises.clear()
    manager.arabicFallbackFamilies = []
    manager.arabicFallbackPromise = null

    let fallbackRenderCount = 0
    let renderCount = 0
    const originalRender = renderer.renderFromEditorState.bind(renderer)

    fontManager.ensureCJKFallback = async (script = 'cjk') => {
      await (script === 'cjk-sc' ? simplifiedFallbackGate : genericFallbackGate)
      const families = ['Regression CJK Fallback']
      manager.cjkFallbackFamilies.set(script, families)
      return families
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

      releaseGenericCJKFallback?.()
      await new Promise((resolve) => {
        setTimeout(resolve, 0)
      })
      await new Promise(requestAnimationFrame)
      const loadedAfterGenericFallback = renderer.isNodeFontLoaded(text)
      const afterGenericFallbackRenderCount = fallbackRenderCount

      const scriptFallbackPromise = fontManager.ensureFallbackPack(['cjk-sc'])
      releaseSimplifiedCJKFallback?.()
      const scriptFallbacks = await scriptFallbackPromise

      return {
        loadedBeforeFallback,
        loadedAfterGenericFallback,
        loadedAfterScriptFallback: renderer.isNodeFontLoaded(text),
        beforeFallbackRenderCount,
        afterGenericFallbackRenderCount,
        fallbackRenderCount,
        renderCount,
        scriptFallbacks
      }
    } finally {
      manager.cjkFallbackFamilies.clear()
      for (const [script, families] of originalCJKFamilies) {
        manager.cjkFallbackFamilies.set(script, families)
      }
      manager.cjkFallbackPromises.clear()
      for (const [script, promise] of originalCJKPromises) {
        manager.cjkFallbackPromises.set(script, promise)
      }
      manager.arabicFallbackFamilies = originalArabicFamilies
      manager.arabicFallbackPromise = originalArabicPromise
      fontManager.ensureCJKFallback = originalEnsureCJKFallback
      fontManager.ensureArabicFallback = originalEnsureArabicFallback
      renderer.renderFromEditorState = originalRender
    }
  })

  expect(result.loadedBeforeFallback).toBe(false)
  expect(result.loadedAfterGenericFallback).toBe(true)
  expect(result.loadedAfterScriptFallback).toBe(true)
  expect(result.beforeFallbackRenderCount).toBe(0)
  expect(result.afterGenericFallbackRenderCount).toBe(1)
  expect(result.fallbackRenderCount).toBe(1)
  expect(result.scriptFallbacks).toEqual({ 'cjk-sc': ['Regression CJK Fallback'] })
  expect(result.renderCount).toBeGreaterThan(0)
  canvas.assertNoErrors()
})
