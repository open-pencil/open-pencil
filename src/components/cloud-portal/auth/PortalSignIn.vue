<script setup lang="ts">
import { computed, ref } from 'vue'

import { useCloudPortalMessages } from '@open-pencil/vue'

import AppButton from '@/components/ui/button/AppButton.vue'
import AppAlert from '@/components/ui/feedback/AppAlert.vue'
import AppInput from '@/components/ui/input/AppInput.vue'
import AppActionRow from '@/components/ui/list/AppActionRow.vue'
import { portalForm } from '@/theme/cloud-portal/form'

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

const ui = portalForm()
const messages = useCloudPortalMessages()
const name = ref('')
const email = ref('')
const password = ref('')
const signUp = computed(() => mode === 'sign-up')
const labels = computed<Record<PortalSignInMethod, string>>(() => ({
  google: messages.value.continueWithGoogle,
  apple: messages.value.continueWithApple
}))
const description = computed(() => {
  if (returnsTo) {
    return messages.value.returnsTo({
      destination:
        returnsTo === 'desktop' ? messages.value.returnsToDesktop : messages.value.returnsToEditor
    })
  }
  return signUp.value ? messages.value.signUpDescription : messages.value.signInWelcome
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

    <div v-if="providers.length" :class="ui.methods()">
      <AppActionRow
        v-for="method in providers"
        :key="method"
        :disabled="submitting"
        @click="emit('provider', method)"
      >
        <template #leading>
          <icon-ai-google v-if="method === 'google'" class="size-4 text-surface" />
          <icon-ai-apple v-else class="size-4 text-surface" />
        </template>
        {{ labels[method] }}
        <template #trailing><icon-lucide-chevron-right class="size-3.5" /></template>
      </AppActionRow>
    </div>

    <div v-if="providers.length && showForm" :class="ui.divider()">
      <span :class="ui.dividerLine()" />{{ messages.or }}<span :class="ui.dividerLine()" />
    </div>

    <form
      v-if="showForm && emailPassword"
      :class="ui.form()"
      novalidate
      @submit.prevent="emit('submit', { name, email, password })"
    >
      <div v-if="signUp" :class="ui.field()">
        <label for="portal-name" :class="ui.label()">{{ messages.name }}</label>
        <AppInput id="portal-name" v-model="name" autocomplete="name" />
      </div>
      <div :class="ui.field()">
        <label for="portal-email" :class="ui.label()">{{ messages.email }}</label>
        <AppInput
          id="portal-email"
          v-model="email"
          inputmode="email"
          autocomplete="email"
          :placeholder="messages.emailPlaceholder"
        />
      </div>
      <div :class="ui.field()">
        <div :class="ui.labelRow()">
          <label for="portal-password" :class="ui.label()">{{ messages.password }}</label>
          <AppButton
            v-if="!signUp"
            size="xs"
            variant="link"
            type="button"
            @click="emit('forgotPassword')"
          >
            {{ messages.forgotPassword }}
          </AppButton>
        </div>
        <AppInput
          id="portal-password"
          v-model="password"
          type="password"
          :autocomplete="signUp ? 'new-password' : 'current-password'"
        />
        <p v-if="signUp" :class="ui.hint()">
          {{ messages.passwordHint({ count: emailPassword.minimumPasswordLength }) }}
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
        {{ signUp ? messages.createAccount : messages.signIn }}
      </AppButton>
    </form>

    <template v-if="emailPassword?.signUp || signUp" #footer>
      {{ signUp ? messages.haveAccount : messages.newHere }}
      <AppButton size="xs" variant="link" @click="emit('switchMode')">
        {{ signUp ? messages.signIn : messages.createAnAccount }}
      </AppButton>
    </template>
  </PortalPublicLayout>
</template>
