import { useLocalStorage } from '@vueuse/core'
import { computed } from 'vue'

import { resolveWebMCPMode } from './policy'
import { type WebMCPMode } from './schema'

const storedMode = useLocalStorage('open-pencil:webmcp:mode', 'off')

export const webmcpMode = computed<WebMCPMode>({
  get: () => resolveWebMCPMode(storedMode.value),
  set: (mode) => {
    storedMode.value = resolveWebMCPMode(mode)
  }
})
