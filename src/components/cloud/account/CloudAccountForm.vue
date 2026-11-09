<script setup lang="ts">
import { computed, toRef, useTemplateRef, watch } from 'vue'

import { useCloudPortalMessages } from '@open-pencil/vue/i18n'

import {
  useCloudAccountForm,
  type CloudAccountCredentials,
  type CloudAccountFormMode
} from '@/app/cloud/sessions/account-form'
import { portalForm } from '@/components/cloud-portal/ui'
import AppButton from '@/components/ui/button/AppButton.vue'
import AppFormField from '@/components/ui/input/AppFormField.vue'
import AppInput from '@/components/ui/input/AppInput.vue'
import AppPasswordInput from '@/components/ui/input/AppPasswordInput.vue'
import { focusFirstInvalid } from '@/components/ui/input/form-field'

/**
 * The email and password form for a Cloud server, in the editor's connect dialog and, larger, on
 * the server's own pages. The submit button lives with the host's actions and names this form by
 * `id`.
 */
const {
  id,
  mode,
  minimumPasswordLength,
  disabled = false,
  size = 'md'
} = defineProps<{
  id: string
  mode: CloudAccountFormMode
  minimumPasswordLength: number
  disabled?: boolean
  size?: 'md' | 'lg'
}>()

const emit = defineEmits<{ submit: [credentials: CloudAccountCredentials]; forgotPassword: [] }>()

const ui = computed(() => portalForm({ size }))
const messages = useCloudPortalMessages()
const form = useCloudAccountForm(
  toRef(() => mode),
  toRef(() => minimumPasswordLength),
  messages
)
const { name, email, password, repeat } = form.fields
const { errors } = form
const root = useTemplateRef<HTMLFormElement>('root')
const submit = form.submit(
  (credentials) => emit('submit', credentials),
  () => void focusFirstInvalid(root.value)
)
watch(() => mode, form.switchMode)
</script>

<template>
  <form ref="root" :id="id" :class="ui.form()" novalidate @submit.prevent="submit">
    <fieldset :disabled="disabled" class="contents">
      <AppFormField
        v-if="mode === 'sign-up'"
        :id="`${id}-name`"
        :size="size"
        :label="messages.name"
        :error="errors.name"
      >
        <template #default="{ id: fieldId, invalid, describedBy }">
          <AppInput
            :id="fieldId"
            v-model="name"
            :size="size"
            autocomplete="name"
            :state="invalid ? 'invalid' : 'idle'"
            :aria-invalid="invalid || undefined"
            :aria-describedby="describedBy"
            @blur="form.blur('name')"
          />
        </template>
      </AppFormField>
      <AppFormField :id="`${id}-email`" :size="size" :label="messages.email" :error="errors.email">
        <template #default="{ id: fieldId, invalid, describedBy }">
          <AppInput
            :id="fieldId"
            v-model="email"
            :size="size"
            type="email"
            inputmode="email"
            autocomplete="email"
            :placeholder="messages.emailPlaceholder"
            :state="invalid ? 'invalid' : 'idle'"
            :aria-invalid="invalid || undefined"
            :aria-describedby="describedBy"
            @blur="form.blur('email')"
          />
        </template>
      </AppFormField>
      <AppFormField
        :id="`${id}-password`"
        :size="size"
        :label="messages.password"
        :error="errors.password"
        :hint="
          mode === 'sign-up' ? messages.passwordHint({ count: minimumPasswordLength }) : undefined
        "
      >
        <template v-if="mode === 'sign-in'" #label-actions>
          <AppButton
            :size="size === 'lg' ? 'lg' : 'xs'"
            :class="ui.inlineLink()"
            variant="link"
            type="button"
            @click="emit('forgotPassword')"
          >
            {{ messages.forgotPassword }}
          </AppButton>
        </template>
        <template #default="{ id: fieldId, invalid, describedBy }">
          <AppPasswordInput
            :id="fieldId"
            v-model="password"
            :size="size"
            :autocomplete="mode === 'sign-up' ? 'new-password' : 'current-password'"
            :state="invalid ? 'invalid' : 'idle'"
            :aria-invalid="invalid || undefined"
            :aria-describedby="describedBy"
            @blur="form.blur('password')"
          />
        </template>
      </AppFormField>
      <AppFormField
        v-if="mode === 'sign-up'"
        :id="`${id}-repeat`"
        :size="size"
        :label="messages.repeatPassword"
        :error="errors.repeat"
      >
        <template #default="{ id: fieldId, invalid, describedBy }">
          <AppPasswordInput
            :id="fieldId"
            v-model="repeat"
            :size="size"
            autocomplete="new-password"
            :state="invalid ? 'invalid' : 'idle'"
            :aria-invalid="invalid || undefined"
            :aria-describedby="describedBy"
            @blur="form.blur('repeat')"
          />
        </template>
      </AppFormField>
    </fieldset>
  </form>
</template>
