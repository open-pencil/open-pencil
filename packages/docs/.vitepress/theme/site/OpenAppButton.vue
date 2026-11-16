<script setup lang="ts">
import { useData } from 'vitepress'
import { VPButton } from 'vitepress/theme'
import { computed } from 'vue'

import { APP_URL } from './links'
import { SITE_MESSAGES } from './messages'

/** The header's main action: the editor, as a button rather than one more link. */
const { place } = defineProps<{ place: 'bar' | 'screen' }>()
const { localeIndex } = useData()
const label = computed(
  () =>
    (SITE_MESSAGES[localeIndex.value as keyof typeof SITE_MESSAGES] ?? SITE_MESSAGES.root).openApp
)
</script>

<template>
  <VPButton :class="['open-app', place]" :href="APP_URL" :text="label" />
</template>

<style scoped>
.open-app.bar {
  margin-left: 16px;
  padding: 0 14px;
  font-size: 13px;
  line-height: 32px;
}

/* The bar keeps its room for the menu on narrow screens; the menu screen shows the button. */
@media (max-width: 767px) {
  .open-app.bar {
    display: none;
  }
}

.open-app.screen {
  width: 100%;
  margin-top: 24px;
  text-align: center;
}
</style>
