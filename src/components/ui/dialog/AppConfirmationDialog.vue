<script setup lang="ts">
import { AlertDialogCancel, AlertDialogDescription, AlertDialogTitle } from 'reka-ui'
import { computed, ref, watch } from 'vue'

import AppButton from '@/components/ui/button/AppButton.vue'

import AppAlertDialogRoot from './AppAlertDialogRoot.vue'
import AppConfirmTextField from './AppConfirmTextField.vue'
import AppDialogBody from './AppDialogBody.vue'
import AppDialogFooter from './AppDialogFooter.vue'
import { useDialogUI } from './ui'

const {
  heading,
  description,
  cancelLabel,
  confirmLabel,
  tone = 'primary',
  confirmDisabled = false,
  confirmLoading = false,
  confirmText
} = defineProps<{
  heading: string
  description?: string
  cancelLabel: string
  confirmLabel: string
  tone?: 'neutral' | 'primary' | 'warning' | 'danger'
  confirmDisabled?: boolean
  confirmLoading?: boolean
  /** What must be typed out before confirming, such as the name of what is deleted. */
  confirmText?: string
}>()

const emit = defineEmits<{ confirm: []; cancel: [] }>()
const open = defineModel<boolean>('open', { default: false })
const cls = useDialogUI()
const typedMatches = ref(false)
/** Counts openings, so the typed field starts empty each time, even mid close animation. */
const openings = ref(0)
watch(open, (value) => {
  if (value) openings.value++
})
const blocked = computed(
  () => confirmDisabled || (confirmText !== undefined && !typedMatches.value)
)
/**
 * Confirms, then closes. Reka's action closes first, so a caller that forgets its pending action
 * when the dialog closes would lose it before the confirmation arrived.
 */
function confirm() {
  if (blocked.value) return
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
    <div data-slot="dialog-header" :class="cls.header">
      <AlertDialogTitle data-slot="dialog-title" :class="cls.title">{{ heading }}</AlertDialogTitle>
    </div>
    <AppDialogBody
      v-if="description || confirmText !== undefined || $slots.default"
      :ui="{ body: 'flex flex-col gap-3' }"
    >
      <AlertDialogDescription v-if="description" :class="cls.description">{{
        description
      }}</AlertDialogDescription>
      <AppConfirmTextField
        v-if="confirmText !== undefined"
        :key="openings"
        v-model:matched="typedMatches"
        :expected="confirmText"
        @enter="confirm"
      />
      <!-- Anything else the person fills in before confirming, such as a reason. -->
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
        :disabled="blocked"
        :loading="confirmLoading"
        @click="confirm"
        >{{ confirmLabel }}</AppButton
      >
    </AppDialogFooter>
  </AppAlertDialogRoot>
</template>
