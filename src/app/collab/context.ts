import { inject, type InjectionKey } from 'vue'

import type { useCollab } from '@/app/collab/use'

export type CollabReturn = ReturnType<typeof useCollab>
export const COLLAB_KEY = Symbol('collab') as InjectionKey<CollabReturn>

export function useCollabInjected() {
  return inject(COLLAB_KEY)
}
