<script setup lang="ts">
import { computed, ref } from 'vue'

import { useMessages } from '@open-pencil/vue/i18n'

import { portalForm } from '@/components/cloud-portal/ui'
import AppButton from '@/components/ui/button/AppButton.vue'
import AppAlert from '@/components/ui/feedback/AppAlert.vue'
import AppInput from '@/components/ui/input/AppInput.vue'

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

const ui = portalForm({ size: 'lg' })
const messages = useMessages('cloud/portal')
const code = ref('')
// Nothing to check until a code is typed: an empty one would only come back as an error.
const entered = computed(() => code.value.trim() !== '')
function submit() {
  if (entered.value) emit('verify', code.value.trim())
}
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
    <form :class="ui.form()" novalidate @submit.prevent="submit">
      <AppInput
        v-model="code"
        size="lg"
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
        size="lg"
        color="primary"
        variant="solid"
        :class="ui.submit()"
        :loading="verifying"
        :disabled="!entered"
      >
        {{ messages.continue }}
      </AppButton>
    </form>
    <template #aside>
      <AppButton
        size="lg"
        color="primary"
        variant="link"
        :class="ui.inlineLink()"
        @click="emit('switchMethod')"
      >
        {{ method === 'authenticator' ? messages.useRecoveryCode : messages.useAuthenticator }}
      </AppButton>
      <template v-if="passkeys">
        <span aria-hidden="true">·</span>
        <AppButton
          size="lg"
          color="primary"
          variant="link"
          :class="ui.inlineLink()"
          :disabled="verifying"
          @click="emit('passkey')"
        >
          {{ messages.usePasskey }}
        </AppButton>
      </template>
    </template>
  </PortalPublicLayout>
</template>
