<script setup lang="ts">
import { useTemplateRef, watch } from 'vue'

import AppButton from '@/components/ui/button/AppButton.vue'
import AppAlert from '@/components/ui/feedback/AppAlert.vue'

import AppDialogBody from './AppDialogBody.vue'
import AppDialogFooter from './AppDialogFooter.vue'
import AppDialogHeader from './AppDialogHeader.vue'
import AppDialogRoot from './AppDialogRoot.vue'
import type { DialogVariants } from './ui'

/**
 * A dialog that is one form: its fields in the default slot, why the last try failed under them,
 * and Cancel and the submit button in the footer. Enter in a field submits, and so does the
 * button, unless it is disabled or saving; the caller closes the dialog when it is done.
 */
const {
  heading,
  description,
  closeLabel,
  cancelLabel,
  submitLabel,
  error = null,
  errorHeading,
  saving = false,
  submitDisabled = false,
  tone = 'primary',
  size = 'sm',
  buttonSize = 'sm'
} = defineProps<{
  heading: string
  description?: string
  closeLabel?: string
  cancelLabel: string
  submitLabel: string
  /**
   * Why the last submit failed. Shown as the alert's heading, or as its description under
   * `errorHeading` when there is one.
   */
  error?: string | null
  errorHeading?: string
  saving?: boolean
  submitDisabled?: boolean
  /** Danger colours the submit button for something that cannot be undone. */
  tone?: 'primary' | 'danger'
  size?: DialogVariants['size']
  buttonSize?: 'sm' | 'md'
}>()
const open = defineModel<boolean>('open', { default: false })
const emit = defineEmits<{ submit: []; cancel: []; open: [] }>()

// Callers fill their fields on `open`: clearing them as the dialog closes would empty them
// during its exit animation.
watch(
  open,
  (value) => {
    if (value) emit('open')
  },
  { immediate: true }
)

const form = useTemplateRef<HTMLFormElement>('form')
/**
 * Opens on the field marked `autofocus`: the attribute alone does nothing in content mounted after
 * the page loaded, and the dialog would focus its first button instead.
 */
function focusField(event: Event) {
  const field = form.value?.querySelector<HTMLElement>('[autofocus]')
  if (!field) return
  event.preventDefault()
  field.focus()
}

/** Enter in a field submits too, so a disabled or busy dialog ignores it there as well. */
function submit() {
  if (!submitDisabled && !saving) emit('submit')
}

function cancel() {
  emit('cancel')
  open.value = false
}
</script>

<template>
  <AppDialogRoot v-model:open="open" :size="size" @open-auto-focus="focusField">
    <AppDialogHeader :heading="heading" :description="description" :close-label="closeLabel" />
    <form ref="form" novalidate class="flex min-h-0 flex-1 flex-col" @submit.prevent="submit">
      <AppDialogBody :ui="{ body: 'flex flex-col gap-3' }">
        <slot />
        <AppAlert
          v-if="error"
          tone="error"
          :heading="errorHeading ?? error"
          :description="errorHeading ? error : undefined"
        />
      </AppDialogBody>
      <AppDialogFooter>
        <AppButton type="button" :size="buttonSize" @click="cancel">{{ cancelLabel }}</AppButton>
        <AppButton
          type="submit"
          :size="buttonSize"
          :color="tone === 'danger' ? 'error' : 'primary'"
          variant="solid"
          :loading="saving"
          :disabled="submitDisabled"
        >
          {{ submitLabel }}
        </AppButton>
      </AppDialogFooter>
    </form>
  </AppDialogRoot>
</template>
