<script setup lang="ts">
import { computed, toRef, watch } from 'vue'

import { useCloudPortalMessages } from '@open-pencil/vue/i18n'

import {
  useCloudAccountForm,
  type CloudAccountCredentials,
  type CloudAccountFormMode
} from '@/app/cloud/sessions/account-form'
import { portalForm } from '@/components/cloud-portal/ui'
import AppButton from '@/components/ui/button/AppButton.vue'
import AppInput from '@/components/ui/input/AppInput.vue'
import AppPasswordInput from '@/components/ui/input/AppPasswordInput.vue'

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
const submit = form.submit((credentials) => emit('submit', credentials))
watch(() => mode, form.switchMode)

function describedBy(field: 'name' | 'email' | 'password' | 'repeat', hint = false) {
  if (errors.value[field]) return `${id}-${field}-error`
  return hint ? `${id}-${field}-hint` : undefined
}
</script>

<template>
  <form :id="id" :class="ui.form()" novalidate @submit.prevent="submit">
    <fieldset :disabled="disabled" class="contents">
      <div v-if="mode === 'sign-up'" :class="ui.field()">
        <label :for="`${id}-name`" :class="ui.label()">{{ messages.name }}</label>
        <AppInput
          :size="size"
          :id="`${id}-name`"
          v-model="name"
          autocomplete="name"
          :state="errors.name ? 'invalid' : 'idle'"
          :aria-invalid="errors.name ? true : undefined"
          :aria-describedby="describedBy('name')"
          @blur="form.blur('name')"
        />
        <p v-if="errors.name" :id="`${id}-name-error`" :class="ui.error()">
          {{ errors.name }}
        </p>
      </div>
      <div :class="ui.field()">
        <label :for="`${id}-email`" :class="ui.label()">{{ messages.email }}</label>
        <AppInput
          :size="size"
          :id="`${id}-email`"
          v-model="email"
          type="email"
          inputmode="email"
          autocomplete="email"
          :placeholder="messages.emailPlaceholder"
          :state="errors.email ? 'invalid' : 'idle'"
          :aria-invalid="errors.email ? true : undefined"
          :aria-describedby="describedBy('email')"
          @blur="form.blur('email')"
        />
        <p v-if="errors.email" :id="`${id}-email-error`" :class="ui.error()">
          {{ errors.email }}
        </p>
      </div>
      <div :class="ui.field()">
        <div :class="ui.labelRow()">
          <label :for="`${id}-password`" :class="ui.label()">{{ messages.password }}</label>
          <AppButton
            v-if="mode === 'sign-in'"
            :size="size === 'lg' ? 'lg' : 'xs'"
            :class="ui.inlineLink()"
            variant="link"
            type="button"
            @click="emit('forgotPassword')"
          >
            {{ messages.forgotPassword }}
          </AppButton>
        </div>
        <AppPasswordInput
          :size="size"
          :id="`${id}-password`"
          v-model="password"
          :autocomplete="mode === 'sign-up' ? 'new-password' : 'current-password'"
          :state="errors.password ? 'invalid' : 'idle'"
          :aria-invalid="errors.password ? true : undefined"
          :aria-describedby="describedBy('password', mode === 'sign-up')"
          @blur="form.blur('password')"
        />
        <p v-if="errors.password" :id="`${id}-password-error`" :class="ui.error()">
          {{ errors.password }}
        </p>
        <p v-else-if="mode === 'sign-up'" :id="`${id}-password-hint`" :class="ui.hint()">
          {{ messages.passwordHint({ count: minimumPasswordLength }) }}
        </p>
      </div>
      <div v-if="mode === 'sign-up'" :class="ui.field()">
        <label :for="`${id}-repeat`" :class="ui.label()">{{ messages.repeatPassword }}</label>
        <AppPasswordInput
          :size="size"
          :id="`${id}-repeat`"
          v-model="repeat"
          autocomplete="new-password"
          :state="errors.repeat ? 'invalid' : 'idle'"
          :aria-invalid="errors.repeat ? true : undefined"
          :aria-describedby="describedBy('repeat')"
          @blur="form.blur('repeat')"
        />
        <p v-if="errors.repeat" :id="`${id}-repeat-error`" :class="ui.error()">
          {{ errors.repeat }}
        </p>
      </div>
    </fieldset>
  </form>
</template>
