import { shallowRef, watch } from 'vue'

import type { EditorStore } from '@/app/editor/session'
import { allTabs, getTabForStore, onTabDocumentReplaced } from '@/app/tabs'

import type { CloudShareLink } from '../sharing/link'

/** Tabs opened from a share link, by the link, so their viewers can report what they show. */
export const cloudShareLinkTabs = shallowRef<ReadonlyMap<EditorStore, CloudShareLink>>(new Map())

function forget(store: EditorStore): void {
  if (!cloudShareLinkTabs.value.has(store)) return
  const next = new Map(cloudShareLinkTabs.value)
  next.delete(store)
  cloudShareLinkTabs.value = next
}

// A tab that opens another file no longer shows the link's document.
onTabDocumentReplaced(forget)

/** Remembers the link a tab opened from, until the tab closes or opens another document. */
export function rememberShareLinkTab(store: EditorStore, link: CloudShareLink): void {
  const known = cloudShareLinkTabs.value.has(store)
  cloudShareLinkTabs.value = new Map(cloudShareLinkTabs.value).set(store, link)
  if (known) return
  const stopWatching = watch(allTabs, () => {
    if (getTabForStore(store)) return
    stopWatching()
    forget(store)
  })
}
