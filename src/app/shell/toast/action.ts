import { useTimeoutFn } from '@vueuse/core'

import { useEditorStore } from '@/app/editor/active-store'
import { ACTION_TOAST_DURATION } from '@/constants'

export function useActionToast() {
  const store = useEditorStore()
  const { start: scheduleHideToast, stop: cancelHideToast } = useTimeoutFn(
    () => {
      store.state.actionToast = null
    },
    ACTION_TOAST_DURATION,
    { immediate: false }
  )

  function showActionToast(label: string) {
    store.state.actionToast = label
    cancelHideToast()
    scheduleHideToast()
  }

  return {
    showActionToast
  }
}
