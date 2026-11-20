// A design kept only on this device carries its name in its recovery copy, which is written when
// the document changes. A rename alone changes nothing the copy tracks, so the copy, and every
// reload, would keep the old name; renaming such a design counts as a change to it.
import { watch } from 'vue'

import type { EditorStore } from '@/app/editor/session'
import { allTabs, getTabsSnapshot, type Tab } from '@/app/tabs/state'

/** Marks a renamed design changed, so its copy is written with the new name. */
export function keepDesignNames(designIdOf: (tab: Tab) => string | null): () => void {
  const followed = new WeakMap<EditorStore, () => void>()
  const stop = watch(
    () => allTabs.value,
    () => {
      for (const tab of getTabsSnapshot()) {
        if (tab.kind !== 'document' || followed.has(tab.store)) continue
        const { store } = tab
        const off = store.onDocumentRenamed(() => {
          // Read when renamed: a tab that restores a copy takes its ID while it loads.
          if (designIdOf(tab)) store.markDocumentChanged()
        }).off
        followed.set(store, off)
      }
    },
    { immediate: true }
  )
  return () => {
    stop()
    for (const tab of getTabsSnapshot()) followed.get(tab.store)?.()
  }
}
