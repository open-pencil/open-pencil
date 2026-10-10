<script setup lang="ts">
import { ref } from 'vue'

import AppButton from '@/components/ui/button/AppButton.vue'
import AppAlert from '@/components/ui/feedback/AppAlert.vue'
import AppInput from '@/components/ui/input/AppInput.vue'
import { portalForm } from '@/theme/cloud-portal/form'

import PortalPublicLayout from '../layout/PortalPublicLayout.vue'

/** The second sign-in step: a code from an authenticator app, a recovery code, or a passkey. */
const {
  host,
  method,
  passkeys = false,
  error = null,
  verifying = false
} = defineProps<{
  host: string
  method: 'authenticator' | 'recovery'
  passkeys?: boolean
  error?: string | null
  verifying?: boolean
}>()
const emit = defineEmits<{
  verify: [code: string]
  switchMethod: []
  passkey: []
}>()

const ui = portalForm()
const code = ref('')
</script>

<template>
  <PortalPublicLayout
    :host="host"
    heading="Confirm it’s you"
    :description="
      method === 'authenticator'
        ? 'Enter the 6-digit code from your authenticator app.'
        : 'Enter one of the recovery codes you saved. Each works once.'
    "
  >
    <AppAlert v-if="error" tone="error" heading="That code didn’t work" :description="error" />
    <form :class="ui.form()" novalidate @submit.prevent="emit('verify', code)">
      <AppInput
        v-model="code"
        :inputmode="method === 'authenticator' ? 'numeric' : 'text'"
        autocomplete="one-time-code"
        :aria-label="method === 'authenticator' ? 'Authentication code' : 'Recovery code'"
        :placeholder="method === 'authenticator' ? '000000' : 'xxxx-xxxx'"
        :ui="{ input: ui.code() }"
      />
      <AppButton
        type="submit"
        color="primary"
        variant="solid"
        size="lg"
        :loading="verifying"
        :ui="{ base: ui.submit() }"
      >
        Continue
      </AppButton>
    </form>
    <div class="flex flex-wrap items-center justify-between gap-2">
      <AppButton size="xs" variant="link" @click="emit('switchMethod')">
        {{ method === 'authenticator' ? 'Use a recovery code' : 'Use your authenticator app' }}
      </AppButton>
      <AppButton v-if="passkeys" size="xs" variant="link" @click="emit('passkey')">
        Use a passkey
      </AppButton>
    </div>
  </PortalPublicLayout>
</template>
