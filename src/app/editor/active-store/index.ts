import { hasInjectionContext, inject, provide, shallowRef, triggerRef } from 'vue'
import type { InjectionKey } from 'vue'

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

const EDITOR_STORE_KEY: InjectionKey<EditorStore> = Symbol('editor-store')

/**
 * Pins a subtree to one document. The app shows one document at a time and leaves this
 * unset; a surface that shows several editors at once, such as the docs landing page, gives
 * each its own store so their panels do not all follow the active tab.
 */
export function provideEditorStore(store: EditorStore): void {
  provide(EDITOR_STORE_KEY, store)
}

export function useEditorStore(): EditorStore {
  const scoped = hasInjectionContext() ? inject(EDITOR_STORE_KEY, null) : null
  return scoped ?? storeProxy
}
