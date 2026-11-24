<script setup lang="ts">
import { computed } from 'vue'

import { CLOUD_SOCIAL_PROVIDER_NAMES, type CloudLegalDiscovery } from '@open-pencil/cloud/contract'
import { useMessages } from '@open-pencil/vue/i18n'

import { portalForm } from '@/components/cloud-portal/ui'
import CloudAccountForm from '@/components/cloud/account/CloudAccountForm.vue'
import CloudProviderLogo from '@/components/cloud/account/CloudProviderLogo.vue'
import AppButton from '@/components/ui/button/AppButton.vue'
import AppAlert from '@/components/ui/feedback/AppAlert.vue'

import PortalPublicLayout from '../layout/PortalPublicLayout.vue'
import type { PortalSignInMethod } from '../types'
import PortalLegalNote from './PortalLegalNote.vue'

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
  returnsTo = null,
  withoutAccount = false,
  legal
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
  /** Whether what the person came for can go on without an account, as pairing an agent does. */
  withoutAccount?: boolean
  /** The server's terms and privacy policy, which continuing agrees to. */
  legal?: CloudLegalDiscovery
}>()

const emit = defineEmits<{
  provider: [method: PortalSignInMethod]
  submit: [credentials: { name: string; email: string; password: string }]
  forgotPassword: []
  switchMode: []
  withoutAccount: []
}>()

const ui = portalForm({ size: 'lg' })
const messages = useMessages('cloud/portal')
const signUp = computed(() => mode === 'sign-up')
const label = (method: PortalSignInMethod) =>
  messages.value.continueWith({ provider: CLOUD_SOCIAL_PROVIDER_NAMES[method] })
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
    :tab-title="signUp ? messages.signUpTitle : messages.signIn"
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
        :ui="{ icon: 'size-4' }"
        :disabled="submitting"
        @click="emit('provider', method)"
      >
        <!-- Brand marks read at 16px; the button's own 14px slot would push them below the label. -->
        <template #leading>
          <CloudProviderLogo :provider="method" class="size-full" />
        </template>
        {{ label(method) }}
      </AppButton>
    </div>

    <AppButton
      v-if="withoutAccount && !signUp"
      size="lg"
      variant="outline"
      class="w-full"
      data-test-id="sign-in-without-account"
      @click="emit('withoutAccount')"
    >
      {{ messages.useWithoutAccount }}
    </AppButton>
    <PortalLegalNote :legal="legal" />

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
