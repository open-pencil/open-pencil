<script setup lang="ts">
import { useLocalStorage } from '@vueuse/core'

import { IS_BROWSER, IS_TAURI } from '@/constants'

const dismissed = useLocalStorage('safari-banner-dismissed', false)
const show = !IS_TAURI && IS_BROWSER && !window.showSaveFilePicker
</script>

<template>
  <div
    v-if="show && !dismissed"
    data-test-id="safari-banner"
    class="flex items-center gap-2 border-b border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-xs text-amber-800 dark:text-amber-200"
  >
    <span class="flex-1">
      Your browser doesn't support the local file API. Files will be downloaded instead of saved in
      place.
      <a href="https://www.google.com/chrome/" target="_blank" class="font-medium underline">Use Chrome</a> or
      Edge for full support.
    </span>
    <button
      data-test-id="safari-banner-dismiss"
      class="shrink-0 rounded px-1.5 py-0.5 font-medium text-amber-900 transition-colors hover:bg-amber-500/20 dark:text-amber-300"
      @click="dismissed = true"
    >
      Dismiss
    </button>
  </div>
</template>
