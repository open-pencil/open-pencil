import { take, uniq } from 'es-toolkit'
import { shallowRef, type ShallowRef } from 'vue'

import type { Editor } from '@open-pencil/core/editor'

/** How many pages a tab remembers, including the current one. */
const MAX_RECENT_PAGES = 8

export interface RecentPages {
  /** Visited pages, most recent first; the current page leads. May list deleted pages. */
  ids: Readonly<ShallowRef<readonly string[]>>
  dispose(): void
}

/** Track the pages visited in one editor, for jumping back to them. */
export function createRecentPages(editor: Pick<Editor, 'onEditorEvent' | 'state'>): RecentPages {
  const ids = shallowRef<readonly string[]>([editor.state.currentPageId])
  const visit = (pageId: string) => {
    ids.value = take(uniq([pageId, ...ids.value]), MAX_RECENT_PAGES)
  }
  const stops = [
    editor.onEditorEvent('page:changed', visit),
    // Page IDs belong to the document they came from.
    editor.onEditorEvent('graph:replaced', () => {
      ids.value = [editor.state.currentPageId]
    })
  ]
  return {
    ids,
    dispose: () => {
      for (const stop of stops) stop()
    }
  }
}
