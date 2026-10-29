<script setup lang="ts">
import { computed } from 'vue'

import { useCloudPortalMessages } from '@open-pencil/vue/i18n'

import { portalForm } from '@/components/cloud-portal/ui'
import CloudAccountForm from '@/components/cloud/account/CloudAccountForm.vue'
import AppButton from '@/components/ui/button/AppButton.vue'
import AppAlert from '@/components/ui/feedback/AppAlert.vue'

import PortalPublicLayout from '../layout/PortalPublicLayout.vue'
import type { PortalSignInMethod } from '../types'

/**
 * Signing in to or joining a Cloud server with what it offers: social accounts, email and
 * password, or both. Servers that review new people say so before anyone signs up.
 */
const {
  host,
  mode,
  providers,
  emailPassword,
  approvalRequired = false,
  error = null,
  submitting = false,
  returnsTo = null
} = defineProps<{
  host: string
  mode: 'sign-in' | 'sign-up'
  providers: PortalSignInMethod[]
  emailPassword: { signUp: boolean; minimumPasswordLength: number } | null
  approvalRequired?: boolean
  /** Why the last attempt failed, already worded for people. */
  error?: string | null
  submitting?: boolean
  /** Where the person goes after signing in. */
  returnsTo?: 'desktop' | 'editor' | null
}>()

const emit = defineEmits<{
  provider: [method: PortalSignInMethod]
  submit: [credentials: { name: string; email: string; password: string }]
  forgotPassword: []
  switchMode: []
}>()

const ui = portalForm({ size: 'lg' })
const messages = useCloudPortalMessages()
const signUp = computed(() => mode === 'sign-up')
const labels = computed<Record<PortalSignInMethod, string>>(() => ({
  google: messages.value.continueWithGoogle,
  apple: messages.value.continueWithApple
}))
const description = computed(() => {
  if (!returnsTo) return undefined
  return messages.value.returnsTo({
    destination:
      returnsTo === 'desktop' ? messages.value.returnsToDesktop : messages.value.returnsToEditor
  })
})
const showForm = computed(() => !!emailPassword && (!signUp.value || emailPassword.signUp))
</script>

<template>
  <PortalPublicLayout
    :host="host"
    :heading="signUp ? messages.signUpTitle : messages.signInTitle"
    :description="description"
  >
    <AppAlert
      v-if="signUp && approvalRequired"
      tone="info"
      :heading="messages.approvalTitle"
      :description="messages.approvalDescription"
    />
    <AppAlert v-if="error" tone="error" :heading="messages.signInFailed" :description="error" />
    <AppAlert
      v-if="!providers.length && !showForm"
      tone="warning"
      :heading="messages.signInFailed"
      :description="messages.noSignInMethods"
    />

    <template v-if="showForm && emailPassword">
      <CloudAccountForm
        id="portal-account"
        size="lg"
        :mode="mode"
        :minimum-password-length="emailPassword.minimumPasswordLength"
        :disabled="submitting"
        @submit="(credentials) => emit('submit', credentials)"
        @forgot-password="emit('forgotPassword')"
      />
      <AppButton
        type="submit"
        form="portal-account"
        size="lg"
        color="primary"
        variant="solid"
        :class="ui.submit()"
        :loading="submitting"
      >
        {{ signUp ? messages.createAccount : messages.signIn }}
      </AppButton>
    </template>

    <div v-if="providers.length && showForm" :class="ui.divider()">
      <span :class="ui.dividerLine()" />{{ messages.or }}<span :class="ui.dividerLine()" />
    </div>

    <div v-if="providers.length" :class="ui.methods()">
      <AppButton
        v-for="method in providers"
        :key="method"
        size="lg"
        variant="outline"
        :class="ui.submit()"
        :disabled="submitting"
        @click="emit('provider', method)"
      >
        <template #leading>
          <icon-ai-google v-if="method === 'google'" class="size-4" />
          <icon-ai-apple v-else class="size-4" />
        </template>
        {{ labels[method] }}
      </AppButton>
    </div>

    <template v-if="emailPassword?.signUp || signUp" #aside>
      {{ signUp ? messages.haveAccount : messages.newHere }}
      <AppButton
        size="lg"
        color="primary"
        variant="link"
        :class="ui.inlineLink()"
        @click="emit('switchMode')"
      >
        {{ signUp ? messages.signIn : messages.createAnAccount }}
      </AppButton>
    </template>
  </PortalPublicLayout>
</template>
