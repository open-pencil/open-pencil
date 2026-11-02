<script setup lang="ts">
import { AlertDialogCancel, AlertDialogDescription, AlertDialogTitle } from 'reka-ui'
import { computed } from 'vue'

import AppButton from '@/components/ui/button/AppButton.vue'

import AppAlertDialogRoot from './AppAlertDialogRoot.vue'
import AppDialogBody from './AppDialogBody.vue'
import AppDialogFooter from './AppDialogFooter.vue'

const {
  heading,
  description,
  cancelLabel,
  confirmLabel,
  tone = 'primary',
  confirmDisabled = false,
  confirmLoading = false
} = defineProps<{
  heading: string
  description?: string
  cancelLabel: string
  confirmLabel: string
  tone?: 'neutral' | 'primary' | 'warning' | 'danger'
  confirmDisabled?: boolean
  confirmLoading?: boolean
}>()

const emit = defineEmits<{ confirm: []; cancel: [] }>()
const open = defineModel<boolean>('open', { default: false })
/**
 * Confirms, then closes. Reka's action closes first, so a caller that forgets its pending action
 * when the dialog closes would lose it before the confirmation arrived.
 */
function confirm() {
  emit('confirm')
  open.value = false
}
const confirmColor = computed(() => {
  if (tone === 'danger') return 'error'
  if (tone === 'neutral') return 'neutral'
  return 'primary'
})
</script>

<template>
  <AppAlertDialogRoot v-model:open="open">
    <div class="border-b border-border px-4 py-3">
      <AlertDialogTitle class="text-sm font-semibold text-surface">{{ heading }}</AlertDialogTitle>
    </div>
    <AppDialogBody v-if="description || $slots.default">
      <AlertDialogDescription v-if="description" class="text-xs text-muted">{{
        description
      }}</AlertDialogDescription>
      <!-- What the person must do before confirming, such as typing a name. -->
      <slot />
    </AppDialogBody>
    <AppDialogFooter>
      <AlertDialogCancel as-child>
        <AppButton color="neutral" variant="ghost" @click="emit('cancel')">{{
          cancelLabel
        }}</AppButton>
      </AlertDialogCancel>
      <AppButton
        :color="confirmColor"
        variant="solid"
        :disabled="confirmDisabled"
        :loading="confirmLoading"
        @click="confirm"
        >{{ confirmLabel }}</AppButton
      >
    </AppDialogFooter>
  </AppAlertDialogRoot>
</template>
