import { useEventListener } from '@vueuse/core'
import { computed, type MaybeRefOrGetter } from 'vue'

import { useActiveEditorStoreRef } from '@/app/editor/active-store'

import { follow, followedLabel, presenceOf } from './registry'

/**
 * Who the active document's view follows, for a canvas pane's frame and banner. Your own
 * input on the canvas — a click, scrolling or zooming — stops following; the frame also
 * stops it on Escape.
 */
export function useFollowView(area: MaybeRefOrGetter<HTMLElement | null>) {
  // Presence belongs to the store object itself, not the forwarding proxy components get.
  const storeRef = useActiveEditorStoreRef()
  const label = computed(() => (storeRef.value ? followedLabel(storeRef.value) : null))

  const stop = () => {
    const store = storeRef.value
    if (store && presenceOf(store).following.value) follow(store, null)
  }

  useEventListener(area, ['pointerdown', 'wheel'], stop, { capture: true, passive: true })

  return { label, stop }
}
