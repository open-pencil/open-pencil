<script setup lang="ts">
import { tv, type VariantProps } from 'tailwind-variants'
import { computed } from 'vue'

import AppCopyButton from '@/components/ui/button/AppCopyButton.vue'
import type { ComponentUI } from '@/components/ui/types'
import theme from '@/theme/input/copy-field'

const copyField = tv(theme)
type CopyFieldVariants = VariantProps<typeof copyField>

/**
 * Read-only text with an icon button that copies it and briefly confirms, its label the button's
 * tooltip; without `copyLabel`, only the text, for a code shown to compare rather than to paste.
 * The text is a command, an address, or a code, so it reads left to right in any interface.
 */
const {
  value,
  copyLabel,
  copiedLabel,
  look = 'command',
  ui
} = defineProps<{
  value: string
  copyLabel?: string
  copiedLabel?: string
  look?: NonNullable<CopyFieldVariants['look']>
  ui?: ComponentUI<typeof theme>
}>()

const cls = computed(() => copyField({ look }))
</script>

<template>
  <div data-slot="copy-field" :data-look="look" :class="cls.root({ class: ui?.root })">
    <code dir="ltr" :class="cls.value({ class: ui?.value })">{{ value }}</code>
    <AppCopyButton
      v-if="copyLabel && copiedLabel"
      :value="value"
      :label="copyLabel"
      :copied-label="copiedLabel"
      icon
      :class="cls.copy({ class: ui?.copy })"
    />
  </div>
</template>
