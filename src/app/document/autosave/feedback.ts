import { onScopeDispose, watch } from 'vue'

import { clearSaveFailure, saveErrorText, showSaveFailure } from '@/app/document/io/save/feedback'
import type { EditorStore } from '@/app/editor/session'
import { notificationMessages } from '@/app/i18n/notifications'
import { notify } from '@/app/shell/notifications'
import { allTabs, getTabsSnapshot, switchTab, type Tab } from '@/app/tabs'

/**
 * Reports the automatic saves of `tab`'s document that fail, which nobody waits on: a failure
 * stays shown until a save of the document succeeds, and while the person is away it also sends
 * one system notification, whose click brings the tab forward. Returns what stops it.
 */
function reportAutosaves({ id, store }: Tab): () => void {
  const isOpen = () => getTabsSnapshot().some((tab) => tab.store === store)
  const saved = store.onAutosaved(() => clearSaveFailure(store))
  const failed = store.onAutosaveFailed((error) => {
    const messages = notificationMessages.get()
    const name = store.state.documentName
    const shown = showSaveFailure(
      messages.autosaveFailed({ name, error: saveErrorText(error) }),
      () => store.retryAutosave(),
      { key: store, isOpen }
    )
    if (shown) return
    notify({
      event: 'saveFailed',
      title: messages.saveFailedTitle({ name }),
      body: saveErrorText(error),
      tabId: id,
      tag: `save:${id}`,
      open: () => void switchTab(id)
    })
  })
  return () => {
    saved.off()
    failed.off()
    clearSaveFailure(store)
  }
}

/** Reports the failed automatic saves of each open document, for as long as the app runs. */
export function useAutosaveFeedback(): void {
  const reported = new Map<EditorStore, () => void>()
  watch(
    allTabs,
    () => {
      const documents = getTabsSnapshot().filter((tab) => tab.kind === 'document')
      for (const tab of documents)
        if (!reported.has(tab.store)) reported.set(tab.store, reportAutosaves(tab))
      for (const [store, stop] of reported) {
        if (documents.some((tab) => tab.store === store)) continue
        stop()
        reported.delete(store)
      }
    },
    { immediate: true }
  )
  onScopeDispose(() => {
    for (const stop of reported.values()) stop()
    reported.clear()
  })
}
