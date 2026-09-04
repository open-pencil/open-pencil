<script setup lang="ts">
import { AppButton, AppInput } from '@open-pencil/ui'
import { computed, ref } from 'vue'

import type { CloudDiscovery } from '@open-pencil/cloud/contract'

import { useCloudI18n } from '#admin/i18n/use'
import { createCredentialAuthService, CredentialAuthError } from './service'
import TurnstileChallenge from './TurnstileChallenge.vue'

const { discovery, intent } = defineProps<{
  discovery: CloudDiscovery
  intent: 'sign-in' | 'sign-up'
}>()
const emit = defineEmits<{ verified: []; verificationRequired: [email: string] }>()
const messages = useCloudI18n()
const name = ref('')
const email = ref('')
const password = ref('')
const passwordConfirmation = ref('')
const rememberMe = ref(true)
const pending = ref(false)
const error = ref('')
const passwordVisible = ref(false)
const captchaResponse = ref('')
const isSignUp = computed(() => intent === 'sign-up')
const captcha = computed(() => discovery.authentication.emailPassword?.captcha)
const minimumLength = discovery.authentication.emailPassword?.minimumPasswordLength ?? 15

function errorMessage(cause: unknown): string {
  if (!(cause instanceof CredentialAuthError)) return messages.errors.value.credentialUnknown
  if (cause.code === 'invalid_credentials') return messages.errors.value.invalidCredentials
  if (cause.code === 'email_not_verified') return messages.errors.value.emailNotVerified
  if (cause.code === 'password_too_short') {
    return messages.errors.value.passwordTooShort({ count: minimumLength })
  }
  if (cause.code === 'password_too_long') return messages.errors.value.passwordTooLong
  if (cause.code === 'rate_limited') return messages.errors.value.rateLimited
  return messages.errors.value.credentialUnknown
}

async function submit(): Promise<void> {
  error.value = ''
  if (isSignUp.value && password.value !== passwordConfirmation.value) {
    error.value = messages.errors.value.passwordMismatch
    return
  }
  pending.value = true
  const service = createCredentialAuthService(discovery, {
    captchaResponse: captchaResponse.value || undefined
  })
  try {
    if (isSignUp.value) {
      await service.signUp({
        name: name.value,
        email: email.value,
        password: password.value,
        callbackURL: new URL('/auth/verify-email?state=verified', location.origin).href
      })
      emit('verificationRequired', email.value)
    } else {
      const result = await service.signIn({
        email: email.value,
        password: password.value,
        rememberMe: rememberMe.value
      })
      if ('twoFactorRequired' in result && result.twoFactorRequired) {
        globalThis.location.assign('/auth/two-factor')
        return
      }
      emit('verified')
    }
  } catch (cause) {
    error.value = errorMessage(cause)
  } finally {
    pending.value = false
  }
}
</script>

<template>
  <form class="grid gap-3" @submit.prevent="submit">
    <label v-if="isSignUp" class="grid gap-1 text-xs text-muted">
      {{ messages.auth.value.name }}
      <AppInput v-model="name" name="name" autocomplete="name" required size="lg" />
    </label>
    <label class="grid gap-1 text-xs text-muted">
      {{ messages.auth.value.email }}
      <AppInput v-model="email" name="email" type="email" autocomplete="email" required size="lg" />
    </label>
    <label class="grid gap-1 text-xs text-muted">
      {{ messages.auth.value.password }}
      <span class="relative">
        <AppInput
          v-model="password"
          name="password"
          :type="passwordVisible ? 'text' : 'password'"
          :autocomplete="isSignUp ? 'new-password' : 'current-password'"
          :minlength="minimumLength"
          required
          size="lg"
          class="pr-16"
        />
        <button
          type="button"
          class="absolute inset-y-0 right-2 cursor-pointer border-0 bg-transparent text-xs text-muted hover:text-surface"
          @click="passwordVisible = !passwordVisible"
        >
          {{
            passwordVisible ? messages.auth.value.hidePassword : messages.auth.value.showPassword
          }}
        </button>
      </span>
      <span v-if="isSignUp">{{ messages.auth.value.passwordHint({ count: minimumLength }) }}</span>
    </label>
    <label v-if="isSignUp" class="grid gap-1 text-xs text-muted">
      {{ messages.auth.value.confirmPassword }}
      <AppInput
        v-model="passwordConfirmation"
        name="passwordConfirmation"
        :type="passwordVisible ? 'text' : 'password'"
        autocomplete="new-password"
        :minlength="minimumLength"
        required
        size="lg"
      />
    </label>
    <label v-if="!isSignUp" class="flex items-center gap-2 text-xs text-muted">
      <input v-model="rememberMe" type="checkbox" class="accent-accent" />
      {{ messages.auth.value.rememberMe }}
    </label>
    <TurnstileChallenge
      v-if="captcha"
      :site-key="captcha.siteKey"
      @update="captchaResponse = $event"
    />
    <p v-if="error" class="m-0 text-xs text-error" role="alert">{{ error }}</p>
    <AppButton
      type="submit"
      color="primary"
      variant="solid"
      size="lg"
      :disabled="Boolean(captcha && !captchaResponse)"
      :loading="pending"
    >
      {{ isSignUp ? messages.auth.value.createAccount : messages.auth.value.signIn }}
    </AppButton>
    <RouterLink
      v-if="!isSignUp"
      to="/auth/forgot-password"
      class="text-center text-xs text-muted underline underline-offset-4"
    >
      {{ messages.auth.value.forgotPassword }}
    </RouterLink>
  </form>
</template>
