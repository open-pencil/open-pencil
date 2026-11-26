import { useLocalStorage } from '@vueuse/core'
import { computed, onMounted, shallowRef } from 'vue'

import { platformOf } from '../landing/download/visitor'

export type KeyPlatform = 'mac' | 'other'

/** The keyboard the reader chose for shortcuts; empty follows their system. */
export function useKeyPlatformChoice() {
  return useLocalStorage<KeyPlatform | ''>('open-pencil-docs:keys', '', { initOnMounted: true })
}

/** The keyboard whose shortcuts pages show: the reader's choice, or else their system's. */
export function useKeyPlatform() {
  const choice = useKeyPlatformChoice()
  const system = shallowRef<KeyPlatform>('mac')
  onMounted(() => {
    const platform = platformOf(navigator.userAgent, navigator.maxTouchPoints)
    if (platform && platform !== 'mac') system.value = 'other'
  })
  return computed(() => choice.value || system.value)
}
