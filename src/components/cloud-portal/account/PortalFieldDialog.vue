<script setup lang="ts">
import type * as v from 'valibot'
import { useTemplateRef } from 'vue'

import { useCloudPortalMessages } from '@open-pencil/vue/i18n'

import AppButton from '@/components/ui/button/AppButton.vue'
import AppDialogCancel from '@/components/ui/dialog/AppDialogCancel.vue'
import AppFormDialog from '@/components/ui/dialog/AppFormDialog.vue'

import PortalFieldDialogInput from './PortalFieldDialogInput.vue'

/**
 * Changes one detail of the account, such as its name or email: the field starts from `initial`,
 * and `schema` checks it and gives the value sent.
 */
const {
  heading,
  description,
  label,
  submitLabel,
  schema,
  initial = '',
  type = 'text',
  autocomplete,
  placeholder,
  maxlength,
  error = null,
  saving = false
} = defineProps<{
  heading: string
  description: string
  label: string
  submitLabel: string
  schema: v.GenericSchema<string, string>
  initial?: string
  type?: 'text' | 'email'
  autocomplete?: string
  placeholder?: string
  maxlength?: number
  error?: string | null
  saving?: boolean
}>()
const open = defineModel<boolean>('open', { default: false })
const emit = defineEmits<{ submit: [value: string] }>()

const messages = useCloudPortalMessages()
const field = useTemplateRef('field')
</script>

<template>
  <AppFormDialog
    v-model:open="open"
    :heading="heading"
    :description="description"
    :error="error"
    :error-heading="messages.errorTitle"
    @submit="field?.submit()"
  >
    <PortalFieldDialogInput
      ref="field"
      :label="label"
      :schema="schema"
      :initial="initial"
      :type="type"
      :autocomplete="autocomplete"
      :placeholder="placeholder"
      :maxlength="maxlength"
      @submit="emit('submit', $event)"
    />
    <template #footer>
      <AppDialogCancel />
      <AppButton type="submit" color="primary" variant="solid" :loading="saving">
        {{ submitLabel }}
      </AppButton>
    </template>
  </AppFormDialog>
</template>
