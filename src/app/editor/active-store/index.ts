import { shallowRef, triggerRef } from 'vue'

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

/**
 * Stable handle to whichever store is active, so components survive tab switches.
 *
 * Every trap forwards to the live store. Leaving any of them out makes the proxy lie about
 * the store it fronts — `has` in particular, since a missing trap falls through to the empty
 * target and reports `false` for methods that are perfectly callable, silently disabling
 * feature checks written as `'method' in store`.
 */
const storeProxy = new Proxy({} as EditorStore, {
  get(_, prop) {
    return Reflect.get(getActiveEditorStore(), prop)
  },
  set(_, prop, value) {
    return Reflect.set(getActiveEditorStore(), prop, value)
  },
  has(_, prop) {
    return Reflect.has(getActiveEditorStore(), prop)
  },
  ownKeys() {
    return Reflect.ownKeys(getActiveEditorStore())
  },
  getOwnPropertyDescriptor(_, prop) {
    const descriptor = Reflect.getOwnPropertyDescriptor(getActiveEditorStore(), prop)
    // Report as configurable so key enumeration over the empty target stays legal.
    return descriptor && { ...descriptor, configurable: true }
  }
})

export function useEditorStore(): EditorStore {
  return storeProxy
}
