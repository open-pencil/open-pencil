<script setup lang="ts">
import { useI18n } from '@open-pencil/vue/i18n'

import { resolvedAppTheme } from '@/app/shell/theme'
import BrandMark from '@/components/brand/BrandMark.vue'

// The whole window while the app opens what it started with, drawn as the boot splash in
// `index.html` is, so the page goes on looking the same until there is something to show.
const { panels } = useI18n()
</script>

<template>
  <div
    data-test-id="loading-screen"
    role="status"
    aria-busy="true"
    :aria-label="panels.loading"
    class="fixed inset-0 z-50 flex items-center justify-center bg-canvas"
  >
    <BrandMark variant="app-icon" :appearance="resolvedAppTheme" decorative class="size-10" />
    <div
      class="absolute bottom-1/2 left-1/2 h-0.5 w-25 -translate-x-1/2 translate-y-10 overflow-hidden rounded-full bg-surface/8"
    >
      <div
        class="h-full w-2/5 animate-[slide_1s_ease-in-out_infinite] motion-reduce:animate-none rounded-full bg-surface/25"
      />
    </div>
  </div>
</template>
