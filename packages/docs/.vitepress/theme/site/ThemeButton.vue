<script setup lang="ts">
import { useData } from 'vitepress'
import { computed } from 'vue'

import { SITE_MESSAGES } from './messages'

/**
 * The theme as one icon in the header, a moon while dark and a sun while light, from 1320px wide
 * (`Layout.vue`); narrower, VitePress's own switch in its menus stays.
 */
const { isDark, localeIndex } = useData()
const messages = computed(
  () => SITE_MESSAGES[localeIndex.value as keyof typeof SITE_MESSAGES] ?? SITE_MESSAGES.root
)
const label = computed(() => (isDark.value ? messages.value.lightTheme : messages.value.darkTheme))
</script>

<template>
  <button
    type="button"
    class="site-header-icon theme-button"
    :aria-label="label"
    :data-tooltip="label"
    @click="isDark = !isDark"
  >
    <icon-lucide-moon v-if="isDark" aria-hidden="true" />
    <icon-lucide-sun v-else aria-hidden="true" />
  </button>
</template>
