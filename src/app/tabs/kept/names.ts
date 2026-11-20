// A design kept only on this device carries its name in its recovery copy, which is written a few
// seconds after the document changes. A rename alone changes nothing the copy tracks, so the copy,
// and every reload, would keep the old name; renaming such a design counts as a change to it, and
// its copy is written at once.
import { watch } from 'vue'

import { errorMessage } from '@open-pencil/std/errors'

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
          if (!designIdOf(tab)) return
          store.markDocumentChanged()
          // Written now rather than after the edits' few seconds' wait, so a reload right after
          // renaming keeps the name.
          void store.persistRecoveryNow().catch((error: unknown) => {
            console.warn(`[Kept tabs] Could not keep the design's new name: ${errorMessage(error)}`)
          })
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
