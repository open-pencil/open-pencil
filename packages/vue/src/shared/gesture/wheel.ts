import { WheelGesture } from '@use-gesture/vanilla'
import type { EventTypes, Handler, UserWheelConfig } from '@use-gesture/vanilla'
import { watch, shallowRef, onScopeDispose } from 'vue'
import type { Ref } from 'vue'

export function useWheelGesture(
  target: Ref<EventTarget | null>,
  handler: Handler<'wheel', EventTypes['wheel']>,
  config?: UserWheelConfig
) {
  const gesture = shallowRef<WheelGesture | null>(null)

  const stop = watch(
    target,
    (element) => {
      gesture.value?.destroy()
      gesture.value = element ? new WheelGesture(element, handler, config) : null
    },
    { immediate: true }
  )

  onScopeDispose(() => {
    stop()
    gesture.value?.destroy()
    gesture.value = null
  })

  return gesture
}
