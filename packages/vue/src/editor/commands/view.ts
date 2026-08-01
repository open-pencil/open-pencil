import { computed } from 'vue'

import { documentKindRules } from '@open-pencil/core/editor'

import type { EditorCommandMapOptions } from './context'
import type { EditorCommand } from './types'

export function createViewCommands({
  editor,
  capabilities,
  messages: t
}: EditorCommandMapOptions): Pick<
  Record<'view.zoom100' | 'view.zoomFit' | 'view.zoomSelection' | 'view.present', EditorCommand>,
  'view.zoom100' | 'view.zoomFit' | 'view.zoomSelection' | 'view.present'
> {
  return {
    'view.zoom100': {
      id: 'view.zoom100',
      get label() {
        return t.value.zoomTo100
      },
      enabled: computed(() => true),
      run: () => editor.zoomTo100()
    },
    'view.zoomFit': {
      id: 'view.zoomFit',
      get label() {
        return t.value.zoomToFit
      },
      enabled: computed(() => true),
      run: () => editor.zoomToFit()
    },
    'view.zoomSelection': {
      id: 'view.zoomSelection',
      get label() {
        return t.value.zoomToSelection
      },
      enabled: capabilities.canZoomToSelection,
      run: () => editor.zoomToSelection()
    },
    'view.present': {
      id: 'view.present',
      get label() {
        return t.value.present
      },
      enabled: computed(
        () => documentKindRules(editor.state.documentKind).presentable && !editor.state.presenting
      ),
      run: () => {
        if (!documentKindRules(editor.state.documentKind).presentable) return
        if (editor.state.presenting) return
        if (editor.state.editingTextId) editor.commitTextEdit()
        editor.clearSelection()
        editor.state.hoveredNodeId = null
        editor.state.presenting = true
        // Resize from the presentation stage will re-fit; call immediately so the first
        // paint is already edge-to-edge rather than one frame of editing margin.
        editor.zoomToFit()
      }
    }
  }
}
