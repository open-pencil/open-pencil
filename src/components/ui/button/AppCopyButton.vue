<script setup lang="ts">
import { refAutoReset, useClipboard } from '@vueuse/core'

import AppButton from '@/components/ui/button/AppButton.vue'
import IconButton from '@/components/ui/button/IconButton.vue'

import type { AppButtonColor, AppButtonSize, AppButtonVariant } from './button'

/** How long a copy button says it copied. */
const COPIED_DURING = 1500

/**
 * Copies text and confirms in place for a moment: its copy icon turns into a check, and a
 * labelled button says it copied. Text built or read when clicked, such as an export, comes
 * from a function, which the clipboard waits for so Safari keeps the click's permission. The
 * button tells its owner once the text is copied, or that copying it failed.
 */
const {
  value,
  label,
  copiedLabel,
  icon = false,
  size,
  color,
  variant,
  side
} = defineProps<{
  value: string | (() => Promise<string>)
  label: string
  copiedLabel: string
  /** Only the icon, with the label as its tooltip and accessible name. */
  icon?: boolean
  /** The button's own size when left out: `sm` with a label, `xs` as an icon. */
  size?: AppButtonSize
  color?: AppButtonColor
  variant?: AppButtonVariant
  /** Where an icon button's tooltip opens. */
  side?: 'top' | 'bottom' | 'left' | 'right'
}>()
const emit = defineEmits<{ copied: []; failed: [error: unknown] }>()
defineSlots<{
  /** The icon at rest, when what is copied is not plain text, such as a link. */
  icon?(): unknown
}>()

const { copy } = useClipboard({ legacy: true })
/** Set once a copy succeeds; a later one that fails clears it, since the clipboard kept the earlier text. */
const copied = refAutoReset(false, COPIED_DURING)

async function copyValue(): Promise<void> {
  try {
    await copy(value)
    copied.value = true
    emit('copied')
  } catch (error) {
    copied.value = false
    emit('failed', error)
  }
}
</script>

<template>
  <IconButton
    v-if="icon"
    :label="copied ? copiedLabel : label"
    :size="size"
    :side="side"
    @click="copyValue"
  >
    <icon-lucide-check v-if="copied" class="size-3" aria-hidden="true" />
    <slot v-else name="icon"><icon-lucide-copy class="size-3" aria-hidden="true" /></slot>
  </IconButton>
  <AppButton v-else :size="size" :color="color" :variant="variant" @click="copyValue">
    <template #leading>
      <icon-lucide-check v-if="copied" aria-hidden="true" />
      <slot v-else name="icon"><icon-lucide-copy aria-hidden="true" /></slot>
    </template>
    {{ copied ? copiedLabel : label }}
  </AppButton>
</template>
