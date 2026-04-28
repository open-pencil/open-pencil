import { useViewportKind } from '#vue/editor/viewport-kind/use'

import { IS_BROWSER } from '@open-pencil/core/constants'

import type { SkiaRenderer } from '@open-pencil/core/canvas'
import type { Editor } from '@open-pencil/core/editor'

export type RulerVisibilityOptions = {
  showRulers?: boolean
}

export function createRulerVisibility(options?: RulerVisibilityOptions) {
  const params = IS_BROWSER ? new URLSearchParams(window.location.search) : new URLSearchParams()
  const noRulersParam = params.has('no-rulers')
  const { isMobile } = useViewportKind()

  return function shouldShowRulers() {
    if (options?.showRulers === false) return false
    return !noRulersParam && !isMobile.value
  }
}

export function createCanvasHitTests(editor: Editor, getRenderer: () => SkiaRenderer | null) {
  function hitTestSectionTitle(canvasX: number, canvasY: number) {
    return getRenderer()?.hitTestSectionTitle(editor.graph, canvasX, canvasY) ?? null
  }

  function hitTestComponentLabel(canvasX: number, canvasY: number) {
    return getRenderer()?.hitTestComponentLabel(editor.graph, canvasX, canvasY) ?? null
  }

  function hitTestFrameTitle(canvasX: number, canvasY: number) {
    return (
      getRenderer()?.hitTestFrameTitle(editor.graph, canvasX, canvasY, editor.state.selectedIds) ??
      null
    )
  }

  return { hitTestSectionTitle, hitTestComponentLabel, hitTestFrameTitle }
}
