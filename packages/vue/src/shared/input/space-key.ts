import { useEventListener } from '@vueuse/core'
import { ref } from 'vue'

export function useSpaceHeld() {
  const spaceHeld = ref(false)
  useEventListener(window, 'keydown', (event: KeyboardEvent) => {
    if (event.code === 'Space') spaceHeld.value = true
  })
  useEventListener(window, 'keyup', (event: KeyboardEvent) => {
    if (event.code === 'Space') spaceHeld.value = false
  })
  return spaceHeld
}
