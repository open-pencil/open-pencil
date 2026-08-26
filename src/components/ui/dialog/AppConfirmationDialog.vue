<script setup lang="ts">
import {
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogDescription,
  AlertDialogTitle
} from 'reka-ui'
import { computed } from 'vue'

import AppButton from '@/components/ui/AppButton.vue'
import AppDialogBody from './AppDialogBody.vue'
import AppDialogFooter from './AppDialogFooter.vue'
import AppAlertDialogRoot from './AppAlertDialogRoot.vue'

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
    <AppDialogBody v-if="description">
      <AlertDialogDescription class="text-xs text-muted">{{ description }}</AlertDialogDescription>
    </AppDialogBody>
    <AppDialogFooter>
      <AlertDialogCancel as-child>
        <AppButton color="neutral" variant="ghost" @click="emit('cancel')">{{
          cancelLabel
        }}</AppButton>
      </AlertDialogCancel>
      <AlertDialogAction as-child>
        <AppButton
          :color="confirmColor"
          variant="solid"
          :disabled="confirmDisabled"
          :loading="confirmLoading"
          @click="emit('confirm')"
          >{{ confirmLabel }}</AppButton
        >
      </AlertDialogAction>
    </AppDialogFooter>
  </AppAlertDialogRoot>
</template>
