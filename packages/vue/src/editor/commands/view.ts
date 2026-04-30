import { computed } from 'vue'

import type { EditorCommand } from './types'
import type { EditorCommandMapOptions } from './context'

export function createViewCommands({
  editor,
  capabilities,
  messages: t,
}: EditorCommandMapOptions): Pick<
  Record<'view.zoom100' | 'view.zoomFit' | 'view.zoomSelection', EditorCommand>,
  'view.zoom100' | 'view.zoomFit' | 'view.zoomSelection'
> {
  return {
    'view.zoom100': {
      id: 'view.zoom100',
      get label() {
        return t.value.zoomTo100
      },
      enabled: computed(() => true),
      run: () => editor.zoomTo100(),
    },
    'view.zoomFit': {
      id: 'view.zoomFit',
      get label() {
        return t.value.zoomToFit
      },
      enabled: computed(() => true),
      run: () => editor.zoomToFit(),
    },
    'view.zoomSelection': {
      id: 'view.zoomSelection',
      get label() {
        return t.value.zoomToSelection
      },
      enabled: capabilities.canZoomToSelection,
      run: () => editor.zoomToSelection(),
    },
  }
}
