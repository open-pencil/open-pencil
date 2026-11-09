<script setup lang="ts">
import * as v from 'valibot'
import { ref } from 'vue'

import { useCloudPortalMessages } from '@open-pencil/vue/i18n'

import AppFormDialog from '@/components/ui/dialog/AppFormDialog.vue'
import AppFormField from '@/components/ui/input/AppFormField.vue'
import AppInput from '@/components/ui/input/AppInput.vue'

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
const value = ref(initial)
const invalid = ref<string | null>(null)
function reset() {
  value.value = initial
  invalid.value = null
}

function submit() {
  const result = v.safeParse(schema, value.value)
  if (!result.success) {
    invalid.value = result.issues[0].message
    return
  }
  invalid.value = null
  emit('submit', result.output)
}
</script>

<template>
  <AppFormDialog
    v-model:open="open"
    :heading="heading"
    :description="description"
    :close-label="messages.cancel"
    :cancel-label="messages.cancel"
    :submit-label="submitLabel"
    :error="error"
    :error-heading="messages.errorTitle"
    :saving="saving"
    @open="reset"
    @submit="submit"
  >
    <AppFormField :label="label" :error="invalid">
      <template #default="{ id, invalid: hasError, describedBy }">
        <AppInput
          :id="id"
          v-model="value"
          :type="type"
          :autocomplete="autocomplete"
          :maxlength="maxlength"
          autofocus
          :placeholder="placeholder"
          :state="hasError ? 'invalid' : 'idle'"
          :aria-invalid="hasError || undefined"
          :aria-describedby="describedBy"
        />
      </template>
    </AppFormField>
  </AppFormDialog>
</template>
