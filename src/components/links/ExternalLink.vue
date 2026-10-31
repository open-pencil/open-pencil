<script setup lang="ts">
import { tv } from 'tailwind-variants'
import { computed } from 'vue'

import type { ComponentUI } from '@/components/ui/types'
import linkTheme from '@/theme/link'

const { href, ui } = defineProps<{
  href: string
  ui?: ComponentUI<typeof linkTheme>
}>()

const styles = computed(() => {
  const theme = tv(linkTheme)()
  return {
    base: theme.base({ class: ui?.base }),
    icon: theme.icon({ class: ui?.icon })
  }
})

// On the desktop the shell opens the link in the system browser, as it does every link that opens
// a new tab (`useExternalLinks`).
</script>

<template>
  <a :href="href" target="_blank" rel="noopener noreferrer" :class="styles.base">
    <slot />
    <icon-lucide-external-link :class="styles.icon" aria-hidden="true" />
  </a>
</template>
