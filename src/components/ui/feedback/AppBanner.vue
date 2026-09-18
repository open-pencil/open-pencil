<script setup lang="ts">
import { useLocalStorage } from '@vueuse/core'
import { computed } from 'vue'

import { banner, type BannerProps } from './banner'

const { storageKey, testId, ui } = defineProps<BannerProps>()

const dismissed = storageKey ? useLocalStorage(storageKey, false) : null
const styles = computed(() => {
  const theme = banner()
  return {
    root: theme.root({ class: ui?.root }),
    content: theme.content({ class: ui?.content }),
    dismiss: theme.dismiss({ class: ui?.dismiss })
  }
})
</script>

<template>
  <div v-if="!dismissed" :data-test-id="testId" :class="styles.root">
    <span :class="styles.content"><slot /></span>
    <button
      v-if="storageKey"
      :data-test-id="testId ? `${testId}-dismiss` : undefined"
      :class="styles.dismiss"
      @click="dismissed = true"
    >
      <slot name="dismiss" />
    </button>
  </div>
</template>
