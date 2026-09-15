import { watchImmediate } from '@vueuse/core'
import { computed, getCurrentInstance, onDeactivated, ref } from 'vue'
import type { Ref } from 'vue'

import { useRetainedActivity } from './context'

/** Close transient state and remove portals before their owning panel is suspended. */
export function useRetainedPopup(open: Ref<boolean> = ref(false), cancel?: () => void) {
  const activity = useRetainedActivity()
  const portalActive = computed(() => activity?.value ?? true)

  function close() {
    if (open.value) cancel?.()
    open.value = false
  }

  watchImmediate(
    portalActive,
    (active) => {
      if (!active) close()
    },
    { flush: 'sync' }
  )
  if (getCurrentInstance()) onDeactivated(close)

  return { open, portalActive }
}
