<script setup lang="ts">
import * as v from 'valibot'
import { ref, useId, watch } from 'vue'

import { useCloudPortalMessages } from '@open-pencil/vue/i18n'

import { portalForm } from '@/components/cloud-portal/ui'
import AppButton from '@/components/ui/button/AppButton.vue'
import AppDialogBody from '@/components/ui/dialog/AppDialogBody.vue'
import AppDialogFooter from '@/components/ui/dialog/AppDialogFooter.vue'
import AppDialogHeader from '@/components/ui/dialog/AppDialogHeader.vue'
import AppDialogRoot from '@/components/ui/dialog/AppDialogRoot.vue'
import AppAlert from '@/components/ui/feedback/AppAlert.vue'
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

const ui = portalForm()
const messages = useCloudPortalMessages()
const id = useId()
const value = ref(initial)
const invalid = ref<string | null>(null)
watch(open, (next) => {
  value.value = next ? initial : ''
  invalid.value = null
})

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
  <AppDialogRoot v-model:open="open" size="sm">
    <AppDialogHeader :heading="heading" :description="description" :close-label="messages.cancel" />
    <form novalidate @submit.prevent="submit">
      <AppDialogBody :ui="{ body: 'flex flex-col gap-3' }">
        <AppAlert v-if="error" tone="error" :heading="messages.errorTitle" :description="error" />
        <div :class="ui.field()">
          <label :for="id" :class="ui.label()">{{ label }}</label>
          <AppInput
            :id="id"
            v-model="value"
            :type="type"
            :autocomplete="autocomplete"
            :maxlength="maxlength"
            autofocus
            :placeholder="placeholder"
            :state="invalid ? 'invalid' : 'idle'"
          />
          <p v-if="invalid" :class="ui.error()">{{ invalid }}</p>
        </div>
      </AppDialogBody>
      <AppDialogFooter :ui="{ footer: 'justify-between' }">
        <AppButton type="button" @click="open = false">{{ messages.cancel }}</AppButton>
        <AppButton type="submit" color="primary" variant="solid" :loading="saving">
          {{ submitLabel }}
        </AppButton>
      </AppDialogFooter>
    </form>
  </AppDialogRoot>
</template>
