import { computed } from 'vue'

import type { EditorCommandMapOptions } from './context'
import type { EditorCommand, EditorCommandId } from './types'

export function createViewCommands({
  editor,
  capabilities,
  messages: t
}: EditorCommandMapOptions): Record<Extract<EditorCommandId, `view.${string}`>, EditorCommand> {
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
    'view.zoomNextFrame': {
      id: 'view.zoomNextFrame',
      get label() {
        return t.value.zoomToNextFrame
      },
      enabled: computed(() => true),
      run: () => editor.zoomToNextFrame()
    },
    'view.zoomPreviousFrame': {
      id: 'view.zoomPreviousFrame',
      get label() {
        return t.value.zoomToPreviousFrame
      },
      enabled: computed(() => true),
      run: () => editor.zoomToPreviousFrame()
    },
    'view.nextPage': {
      id: 'view.nextPage',
      get label() {
        return t.value.nextPage
      },
      enabled: computed(() => true),
      run: () => void editor.switchToNextPage()
    },
    'view.previousPage': {
      id: 'view.previousPage',
      get label() {
        return t.value.previousPage
      },
      enabled: computed(() => true),
      run: () => void editor.switchToPreviousPage()
    }
  }
}
