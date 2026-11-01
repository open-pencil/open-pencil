import { isEqual } from 'es-toolkit'

import { SceneGraph, type DocumentKind, type EnabledLibraryBinding } from '@open-pencil/scene-graph'

import { BOARD_PAGE_BACKGROUND, type InterfaceTheme } from '#core/constants'
import { offeredTool } from '#core/editor/views'
import { setDefaultPageBackground, setPageBackgrounds } from '#core/figma-api/page-backgrounds'

import type { EditorContext } from './types'

/**
 * An empty document of this kind: a design starts on Figma's page for the interface theme it is
 * made in, a board on FigJam's light page.
 */
export function createDocumentGraph(kind: DocumentKind, theme: InterfaceTheme): SceneGraph {
  const graph = new SceneGraph()
  graph.documentKind = kind
  const [page] = graph.getPages()
  if (kind === 'design') {
    setDefaultPageBackground(graph, page, theme)
  } else {
    setPageBackgrounds(graph, page, [
      {
        type: 'SOLID',
        color: BOARD_PAGE_BACKGROUND,
        opacity: 1,
        visible: true,
        blendMode: 'NORMAL'
      }
    ])
  }
  return graph
}

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

  /**
   * Makes the document a design or a board, which decides the tools, keys, and grid the editor
   * offers; a tool the new kind does not offer gives way to Move.
   */
  function setDocumentKind(kind: DocumentKind) {
    if (ctx.graph.documentKind === kind) return
    ctx.graph.documentKind = kind
    ctx.state.documentKind = kind
    ctx.setActiveTool(offeredTool(ctx.state, ctx.state.activeTool))
    ctx.emitEditorEvent('document:kind-changed', kind)
    ctx.requestRepaint()
  }

  return { updateEnabledLibraries, refreshDocumentSettings, setDocumentKind }
}
