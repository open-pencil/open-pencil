<script setup lang="ts">
import { useTemplateRef } from 'vue'

import AppAlert from '@/components/ui/feedback/AppAlert.vue'
import { focusFirstInvalid } from '@/components/ui/input/form-field'

import AppDialogBody from './AppDialogBody.vue'
import AppDialogFooter from './AppDialogFooter.vue'
import AppDialogHeader from './AppDialogHeader.vue'
import AppDialogRoot from './AppDialogRoot.vue'
import type { DialogVariants } from './ui'

/**
 * A dialog that is one form: its fields in the default slot, why the last try failed under them,
 * and its buttons in the `footer` slot, usually `AppDialogCancel` and a `type="submit"` button.
 * Enter in a field submits; a disabled or loading submit button stops that as it stops a click.
 * The caller closes the dialog when it is done.
 */
const {
  heading,
  description,
  closeLabel,
  error = null,
  errorHeading,
  size = 'sm'
} = defineProps<{
  heading: string
  description?: string
  closeLabel?: string
  /**
   * Why the last submit failed. Shown as the alert's heading, or as its description under
   * `errorHeading` when there is one.
   */
  error?: string | null
  errorHeading?: string
  size?: DialogVariants['size']
}>()
const open = defineModel<boolean>('open', { default: false })
const emit = defineEmits<{ submit: [] }>()

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

function submit() {
  emit('submit')
  // A caller that found a field invalid has marked it by now; the person lands on it.
  void focusFirstInvalid(form.value)
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
      <AppDialogFooter v-if="$slots.footer"><slot name="footer" /></AppDialogFooter>
    </form>
  </AppDialogRoot>
</template>
