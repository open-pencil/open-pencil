import { compact, difference, keyBy, take, without } from 'es-toolkit'
import { computed } from 'vue'
import IconFile from '~icons/lucide/file'
import IconFiles from '~icons/lucide/files'

import type { SceneNode } from '@open-pencil/scene-graph'
import {
  isPageDivider,
  usePageMessages,
  type CommandPaletteGroup,
  type CommandPaletteItem
} from '@open-pencil/vue'

import type { EditorStore } from '@/app/editor/active-store'
import { presenceByPage, type PagePresenceEntry } from '@/app/presence/registry'
import { activeTab } from '@/app/tabs'

/** How many recent pages the unfiltered palette lists. */
const PALETTE_RECENT_PAGES = 5

function pageItem(
  store: EditorStore,
  presence: Map<string, PagePresenceEntry[]>,
  page: SceneNode,
  { note, ...extra }: Partial<CommandPaletteItem> & { note?: string } = {}
): CommandPaletteItem {
  // Who works on the page follows the note, so "Recent · Fern, Ana".
  const people = (presence.get(page.id) ?? []).map((entry) => entry.name).join(', ')
  return {
    id: `page:${page.id}`,
    label: page.name,
    description: [note, people].filter(Boolean).join(' · ') || undefined,
    icon: IconFile,
    onSelect: () => void store.switchPage(page.id),
    ...extra
  }
}

/**
 * Palette entries for the document's pages: recently visited pages first, then a
 * "Go to page" step listing every page. Typing a name also finds pages not listed.
 */
export function usePagePaletteGroup() {
  const messages = usePageMessages()

  return computed<CommandPaletteGroup | null>(() => {
    const tab = activeTab.value
    if (!tab || tab.kind === 'home') return null
    const store = tab.store
    // Pages and their names change with the scene.
    void store.state.sceneVersion
    const current = store.state.currentPageId
    const pages = store.graph.getPages().filter((page) => !isPageDivider(page))
    const byId = keyBy(pages, (page) => page.id)
    // Recent ids may name deleted pages or dividers; those have no entry in byId.
    const recent = take(
      compact(without(store.recentPages.value, current).map((id) => byId[id])),
      PALETTE_RECENT_PAGES
    )
    const presence = presenceByPage(store)
    const others = without(difference(pages, recent), byId[current])

    return {
      id: 'pages',
      label: messages.value.pages,
      items: [
        ...recent.map((page) =>
          pageItem(store, presence, page, { note: messages.value.recentPage })
        ),
        {
          id: 'pages:go-to',
          label: messages.value.goToPage,
          icon: IconFiles,
          children: pages.map((page) =>
            page.id === current
              ? pageItem(store, presence, page, {
                  note: messages.value.currentPage,
                  disabled: true
                })
              : pageItem(store, presence, page)
          )
        },
        ...others.map((page) => pageItem(store, presence, page, { searchOnly: true }))
      ]
    }
  })
}
