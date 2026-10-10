<script setup lang="ts">
import { ref } from 'vue'

import { useCloudPortalMessages } from '@open-pencil/vue'

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
const messages = useCloudPortalMessages()
const code = ref('')
</script>

<template>
  <PortalPublicLayout
    :host="host"
    :heading="messages.twoStepTitle"
    :description="
      method === 'authenticator' ? messages.twoStepAuthenticator : messages.twoStepRecovery
    "
  >
    <AppAlert v-if="error" tone="error" :heading="error" />
    <form :class="ui.form()" novalidate @submit.prevent="emit('verify', code)">
      <AppInput
        v-model="code"
        :inputmode="method === 'authenticator' ? 'numeric' : 'text'"
        autocomplete="one-time-code"
        :aria-label="
          method === 'authenticator' ? messages.authenticationCode : messages.recoveryCode
        "
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
        {{ messages.continue }}
      </AppButton>
    </form>
    <div class="flex flex-wrap items-center justify-between gap-2">
      <AppButton size="xs" variant="link" @click="emit('switchMethod')">
        {{ method === 'authenticator' ? messages.useRecoveryCode : messages.useAuthenticator }}
      </AppButton>
      <AppButton v-if="passkeys" size="xs" variant="link" @click="emit('passkey')">
        {{ messages.usePasskey }}
      </AppButton>
    </div>
  </PortalPublicLayout>
</template>
