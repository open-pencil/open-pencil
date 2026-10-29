import { isEqual } from 'es-toolkit'

import type { EnabledLibraryBinding } from '@open-pencil/scene-graph'

import type { EditorContext } from './types'

export function createDocumentSettingsActions(ctx: EditorContext) {
  /**
   * Changes which library revisions the document uses, and announces it when anything changed,
   * so what follows the document, such as a collaboration room, hears of it.
   */
  function updateEnabledLibraries<T>(
    change: (bindings: Map<string, EnabledLibraryBinding>) => T
  ): T {
    const before = structuredClone(ctx.graph.enabledLibraries)
    const result = change(ctx.graph.enabledLibraries)
    if (!isEqual(before, ctx.graph.enabledLibraries)) {
      ctx.emitEditorEvent('document:libraries-changed')
    }
    return result
  }

  /**
   * Announces libraries and a color space written to the graph from elsewhere, as a
   * collaboration room writes its peers' settings, and draws the document again. It changes
   * nothing itself, so a read-only document offers it, as it does `refreshVariables`.
   */
  function refreshDocumentSettings() {
    ctx.emitEditorEvent('document:libraries-changed')
    ctx.emitEditorEvent('document:color-space-changed', ctx.graph.documentColorSpace)
    ctx.requestRender()
  }

  return { updateEnabledLibraries, refreshDocumentSettings }
}
