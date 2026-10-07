import { hasInjectionContext, inject, provide, shallowRef, triggerRef, watch } from 'vue'
import type { InjectionKey } from 'vue'

import { provideEditor } from '@open-pencil/vue'

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

const TAB_STORE_KEY: InjectionKey<EditorStore> = Symbol('open-pencil-tab-store')

/**
 * Binds a tab's components to that tab's own store, for `useEditorStore` and the SDK's
 * `useEditor`. Without it they would follow the active tab, so a closing tab's canvas would
 * hand its renderers to the next document and never take them back.
 */
export function provideTabEditorStore(store: EditorStore) {
  provide(TAB_STORE_KEY, store)
  provideEditor(store)
}

/**
 * The store of the tab this component belongs to, or the active tab's store outside any tab
 * and outside component setup.
 */
export function useEditorStore(): EditorStore {
  return hasInjectionContext() ? inject(TAB_STORE_KEY, storeProxy) : storeProxy
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
