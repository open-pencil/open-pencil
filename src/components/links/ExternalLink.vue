<script setup lang="ts">
import { tv } from 'tailwind-variants'
import { computed } from 'vue'

import { openExternalLink } from '@/app/shell/ui'
import type { ComponentUI } from '@/components/ui/types'
import { IS_TAURI } from '@/constants'
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

/** Desktop WebViews cannot open external pages themselves, so route them to the system browser. */
function navigate(event: MouseEvent) {
  if (!IS_TAURI) return
  event.preventDefault()
  void openExternalLink(href)
}
</script>

<template>
  <a :href="href" target="_blank" rel="noopener noreferrer" :class="styles.base" @click="navigate">
    <slot />
    <icon-lucide-external-link :class="styles.icon" aria-hidden="true" />
  </a>
</template>
