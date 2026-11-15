<script setup lang="ts">
import { tv, type VariantProps } from 'tailwind-variants'
import { computed } from 'vue'

import AppCopyButton from '@/components/ui/button/AppCopyButton.vue'
import type { ComponentUI } from '@/components/ui/types'
import theme from '@/theme/input/copy-field'

const copyField = tv(theme)
type CopyFieldVariants = VariantProps<typeof copyField>

/** Read-only text with a button that copies it and briefly confirms. */
const {
  value,
  copyLabel,
  copiedLabel,
  look = 'command',
  ui
} = defineProps<{
  value: string
  copyLabel: string
  copiedLabel: string
  look?: NonNullable<CopyFieldVariants['look']>
  ui?: ComponentUI<typeof theme>
}>()

const cls = computed(() => copyField({ look }))
</script>

<template>
  <div data-slot="copy-field" :data-look="look" :class="cls.root({ class: ui?.root })">
    <code :class="cls.value({ class: ui?.value })">{{ value }}</code>
    <AppCopyButton
      :value="value"
      :label="copyLabel"
      :copied-label="copiedLabel"
      size="xs"
      :variant="look === 'plain' ? 'link' : 'ghost'"
    />
  </div>
</template>
