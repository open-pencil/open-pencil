<script setup lang="ts">
import { ref } from 'vue'

import { useCloudPortalMessages } from '@open-pencil/vue'

import AppButton from '@/components/ui/button/AppButton.vue'
import AppAlert from '@/components/ui/feedback/AppAlert.vue'
import AppInput from '@/components/ui/input/AppInput.vue'
import { portalForm } from '@/theme/cloud-portal/form'

import PortalPublicLayout from '../layout/PortalPublicLayout.vue'

/** Both halves of a password reset: asking for a link, then choosing a new password. */
const {
  host,
  step,
  minimumPasswordLength = 15,
  submitting = false,
  error = null
} = defineProps<{
  host: string
  step: 'request' | 'choose'
  minimumPasswordLength?: number
  submitting?: boolean
  error?: string | null
}>()
const emit = defineEmits<{ request: [email: string]; choose: [password: string]; back: [] }>()

const ui = portalForm()
const messages = useCloudPortalMessages()
const value = ref('')
</script>

<template>
  <PortalPublicLayout
    :host="host"
    :heading="step === 'request' ? messages.resetTitle : messages.chooseTitle"
    :description="step === 'request' ? messages.resetDescription : messages.chooseDescription"
  >
    <AppAlert v-if="error" tone="error" :heading="error" />
    <form
      :class="ui.form()"
      novalidate
      @submit.prevent="step === 'request' ? emit('request', value) : emit('choose', value)"
    >
      <div :class="ui.field()">
        <label for="portal-reset" :class="ui.label()">
          {{ step === 'request' ? messages.email : messages.newPassword }}
        </label>
        <AppInput
          id="portal-reset"
          v-model="value"
          :type="step === 'request' ? 'text' : 'password'"
          :inputmode="step === 'request' ? 'email' : undefined"
          :autocomplete="step === 'request' ? 'email' : 'new-password'"
        />
        <p v-if="step === 'choose'" :class="ui.hint()">
          {{ messages.passwordHint({ count: minimumPasswordLength }) }}
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
        {{ step === 'request' ? messages.sendLink : messages.savePassword }}
      </AppButton>
    </form>
    <template #footer>
      <AppButton size="xs" variant="link" @click="emit('back')">{{
        messages.backToSignIn
      }}</AppButton>
    </template>
  </PortalPublicLayout>
</template>
