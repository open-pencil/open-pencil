<script setup lang="ts">
import { computed, ref } from 'vue'

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
  error?: string | null
  submitting?: boolean
  /** Where the person goes after signing in, such as the desktop app or the editor. */
  returnsTo?: string | null
}>()

const emit = defineEmits<{
  provider: [method: PortalSignInMethod]
  submit: [credentials: { name: string; email: string; password: string }]
  forgotPassword: []
  switchMode: []
}>()

const ui = portalForm()
const name = ref('')
const email = ref('')
const password = ref('')
const signUp = computed(() => mode === 'sign-up')
const labels: Record<PortalSignInMethod, string> = {
  google: 'Continue with Google',
  apple: 'Continue with Apple'
}
const description = computed(() => {
  if (returnsTo) return `Then you go back to ${returnsTo}.`
  return signUp.value ? 'Create an account on this server.' : 'Welcome back.'
})
</script>

<template>
  <PortalPublicLayout
    :host="host"
    :heading="signUp ? 'Create your account' : 'Sign in to OpenPencil Cloud'"
    :description="description"
  >
    <AppAlert
      v-if="signUp && approvalRequired"
      tone="info"
      heading="An administrator reviews new accounts"
      description="You can sign in once your request is approved. We email you when it is."
    />
    <AppAlert v-if="error" tone="error" heading="Couldn’t sign in" :description="error" />

    <div v-if="providers.length" :class="ui.methods()">
      <AppActionRow v-for="method in providers" :key="method" @click="emit('provider', method)">
        <template #leading>
          <icon-ai-google v-if="method === 'google'" class="size-4 text-surface" />
          <icon-ai-apple v-else class="size-4 text-surface" />
        </template>
        {{ labels[method] }}
        <template #trailing><icon-lucide-chevron-right class="size-3.5" /></template>
      </AppActionRow>
    </div>

    <div v-if="providers.length && emailPassword" :class="ui.divider()">
      <span :class="ui.dividerLine()" />or<span :class="ui.dividerLine()" />
    </div>

    <form
      v-if="emailPassword && (!signUp || emailPassword.signUp)"
      :class="ui.form()"
      novalidate
      @submit.prevent="emit('submit', { name, email, password })"
    >
      <div v-if="signUp" :class="ui.field()">
        <label for="portal-name" :class="ui.label()">Name</label>
        <AppInput id="portal-name" v-model="name" autocomplete="name" />
      </div>
      <div :class="ui.field()">
        <label for="portal-email" :class="ui.label()">Email</label>
        <AppInput
          id="portal-email"
          v-model="email"
          inputmode="email"
          autocomplete="email"
          placeholder="you@example.com"
        />
      </div>
      <div :class="ui.field()">
        <div :class="ui.labelRow()">
          <label for="portal-password" :class="ui.label()">Password</label>
          <AppButton
            v-if="!signUp"
            size="xs"
            variant="link"
            type="button"
            @click="emit('forgotPassword')"
          >
            Forgot password?
          </AppButton>
        </div>
        <AppInput
          id="portal-password"
          v-model="password"
          type="password"
          :autocomplete="signUp ? 'new-password' : 'current-password'"
        />
        <p v-if="signUp" :class="ui.hint()">
          At least {{ emailPassword.minimumPasswordLength }} characters.
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
        {{ signUp ? 'Create account' : 'Sign in' }}
      </AppButton>
    </form>

    <template v-if="emailPassword?.signUp || signUp" #footer>
      {{ signUp ? 'Already have an account?' : 'New here?' }}
      <AppButton size="xs" variant="link" @click="emit('switchMode')">
        {{ signUp ? 'Sign in' : 'Create an account' }}
      </AppButton>
    </template>
  </PortalPublicLayout>
</template>
