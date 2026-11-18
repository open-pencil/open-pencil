import { onScopeDispose, watch } from 'vue'

import { saveDocument } from '@/app/cloud/integration'
import {
  claimFailureNotice,
  clearSaveFailure,
  saveErrorText,
  saveWithFeedback,
  showSaveFailure
} from '@/app/document/io/save/feedback'
import type { EditorStore } from '@/app/editor/session'
import { notificationMessages } from '@/app/i18n/notifications'
import { notify } from '@/app/shell/notifications'
import { allTabs, getTabsSnapshot, switchTab, type Tab } from '@/app/tabs'

/**
 * Reports the automatic saves of `tab`'s document that fail, which nobody waits on: a failure
 * stays shown until a save of the document succeeds, and Retry saves it as Save does. While the
 * person is away the first failure of a run also sends a system notification, whose click brings
 * the tab forward; a run ends once a save of the document or closing its tab clears the failure.
 */
function reportAutosaves({ id, store }: Tab): () => void {
  const options = { key: store, isOpen: () => getTabsSnapshot().some((tab) => tab.store === store) }
  const saved = store.onAutosaved(() => clearSaveFailure(store))
  const failed = store.onAutosaveFailed((error) => {
    const messages = notificationMessages.get()
    const name = store.state.documentName
    showSaveFailure(
      messages.autosaveFailed({ name, error: saveErrorText(error) }),
      () => saveWithFeedback(() => saveDocument(store), options),
      options
    )
    if (!claimFailureNotice(store)) return
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
