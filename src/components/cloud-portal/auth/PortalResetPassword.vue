<script setup lang="ts">
import { ref } from 'vue'

import AppButton from '@/components/ui/button/AppButton.vue'
import AppInput from '@/components/ui/input/AppInput.vue'
import { portalForm } from '@/theme/cloud-portal/form'

import PortalPublicLayout from '../layout/PortalPublicLayout.vue'

/** Both halves of a password reset: asking for a link, then choosing a new password. */
const {
  host,
  step,
  minimumPasswordLength = 15,
  submitting = false
} = defineProps<{
  host: string
  step: 'request' | 'choose'
  minimumPasswordLength?: number
  submitting?: boolean
}>()
const emit = defineEmits<{ request: [email: string]; choose: [password: string]; back: [] }>()

const ui = portalForm()
const value = ref('')
</script>

<template>
  <PortalPublicLayout
    :host="host"
    :heading="step === 'request' ? 'Reset your password' : 'Choose a new password'"
    :description="
      step === 'request'
        ? 'We email you a link to choose a new one.'
        : 'Signing in with it signs you out everywhere else.'
    "
  >
    <form
      :class="ui.form()"
      novalidate
      @submit.prevent="step === 'request' ? emit('request', value) : emit('choose', value)"
    >
      <div :class="ui.field()">
        <label for="portal-reset" :class="ui.label()">
          {{ step === 'request' ? 'Email' : 'New password' }}
        </label>
        <AppInput
          id="portal-reset"
          v-model="value"
          :type="step === 'request' ? 'text' : 'password'"
          :inputmode="step === 'request' ? 'email' : undefined"
          :autocomplete="step === 'request' ? 'email' : 'new-password'"
        />
        <p v-if="step === 'choose'" :class="ui.hint()">
          At least {{ minimumPasswordLength }} characters.
        </p>
      </div>
      <AppButton
        type="submit"
        color="primary"
        variant="solid"
        size="lg"
        :loading="submitting"
        :ui="{ base: ui.submit() }"
      >
        {{ step === 'request' ? 'Send link' : 'Save password' }}
      </AppButton>
    </form>
    <template #footer>
      <AppButton size="xs" variant="link" @click="emit('back')">Back to sign in</AppButton>
    </template>
  </PortalPublicLayout>
</template>
