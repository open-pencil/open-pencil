import type { SkiaRenderer } from '@open-pencil/core/canvas'
import { IS_BROWSER } from '@open-pencil/core/constants'
import { documentKindRules, type Editor } from '@open-pencil/core/editor'

import { useViewportKind } from '#vue/editor/viewport-kind/use'

export type RulerVisibilityOptions = {
  showRulers?: boolean
}

type RulerEditorState = {
  /** App-extended: the user's own rulers toggle. */
  showRulers?: boolean
}

export function createRulerVisibility(options?: RulerVisibilityOptions, editor?: Editor) {
  const params = IS_BROWSER ? new URLSearchParams(window.location.search) : new URLSearchParams()
  const noRulersParam = params.has('no-rulers')
  const { isMobile } = useViewportKind()

  return function shouldShowRulers() {
    if (options?.showRulers === false) return false
    if (noRulersParam || isMobile.value) return false
    // Decks have no canvas rulers, whatever the user's toggle says.
    if (editor && !documentKindRules(editor.state.documentKind).rulers) return false
    const state = editor?.state as RulerEditorState | undefined
    if (state?.showRulers === false) return false
    return true
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
