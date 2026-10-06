import { shallowRef, triggerRef, watch } from 'vue'

import type { EditorStore } from '@/app/editor/session'

export type { EditorStore }

const storeRef = shallowRef<EditorStore>()

export function useActiveEditorStoreRef() {
  return storeRef
}

export function setActiveEditorStore(store: EditorStore) {
  storeRef.value = store
  triggerRef(storeRef)
}

export function getActiveEditorStore(): EditorStore {
  if (!storeRef.value) throw new Error('Editor store not provided')
  return storeRef.value
}

export function getActiveEditorStoreOrNull(): EditorStore | null {
  return storeRef.value ?? null
}

const storeProxy = new Proxy({} as EditorStore, {
  get(_, prop) {
    return Reflect.get(getActiveEditorStore(), prop)
  }
})

export function useEditorStore(): EditorStore {
  return storeProxy
}

/**
 * Subscribes to the active store and moves the subscription along when another tab becomes
 * active, for consumers that outlive any one document.
 */
const onActiveEditorEvent: EditorStore['onEditorEvent'] = (event, handler) => {
  let stop = storeRef.value?.onEditorEvent(event, handler) ?? null
  const stopFollowing = watch(
    storeRef,
    (store) => {
      stop?.()
      stop = store?.onEditorEvent(event, handler) ?? null
    },
    { flush: 'sync' }
  )
  return () => {
    stopFollowing()
    stop?.()
    stop = null
  }
}

const followingStoreProxy = new Proxy({} as EditorStore, {
  get(_, prop) {
    if (prop === 'onEditorEvent') return onActiveEditorEvent
    return Reflect.get(getActiveEditorStore(), prop)
  }
})

/**
 * The editor for app-level UI that outlives tabs, such as menus, shortcuts and banners. Its
 * event subscriptions follow the active tab, so they neither miss later documents' events nor
 * keep a closed document alive. UI inside a tab gets that tab's own store instead.
 */
export function useFollowingEditorStore(): EditorStore {
  return followingStoreProxy
}
