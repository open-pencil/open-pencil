<script setup lang="ts">
import { AppButton, AppInput } from '@open-pencil/ui'
import { useQuery } from '@tanstack/vue-query'
import { computed, ref } from 'vue'
import { useRoute } from 'vue-router'

import { discoveryQueryOptions } from '#admin/app/query/options'
import PublicShell from '#admin/components/layout/PublicShell.vue'
import { useCloudI18n } from '#admin/i18n/use'
import { createCredentialAuthService, CredentialAuthError } from './credentials/service'

const messages = useCloudI18n()
const route = useRoute()
const discovery = useQuery(discoveryQueryOptions())
const password = ref('')
const confirmation = ref('')
const pending = ref(false)
const complete = ref(false)
const error = ref('')
const token = computed(() => (typeof route.query.token === 'string' ? route.query.token : ''))
const minimumLength = computed(
  () => discovery.data.value?.authentication.emailPassword?.minimumPasswordLength ?? 15
)

async function submit(): Promise<void> {
  if (password.value !== confirmation.value) {
    error.value = messages.errors.value.passwordMismatch
    return
  }
  const instance = discovery.data.value
  if (!instance || !token.value) {
    error.value = messages.errors.value.invalidResetLink
    return
  }
  pending.value = true
  error.value = ''
  try {
    await createCredentialAuthService(instance).resetPassword(password.value, token.value)
    complete.value = true
  } catch (cause) {
    error.value =
      cause instanceof CredentialAuthError && cause.code === 'invalid_token'
        ? messages.errors.value.invalidResetLink
        : messages.errors.value.credentialUnknown
  } finally {
    pending.value = false
  }
}
</script>

<template>
  <PublicShell>
    <main class="grid min-h-[calc(100vh-7rem)] place-items-center p-5">
      <section class="w-full max-w-md rounded-xl border border-border bg-panel p-6 shadow-2xl">
        <h1 class="m-0 text-xl font-semibold">{{ messages.auth.value.resetPasswordTitle }}</h1>
        <p v-if="complete" class="mt-3 text-sm text-muted">
          {{ messages.auth.value.passwordResetComplete }}
        </p>
        <form v-else class="mt-5 grid gap-3" @submit.prevent="submit">
          <label class="grid gap-1 text-xs text-muted">
            {{ messages.auth.value.newPassword }}
            <AppInput
              v-model="password"
              type="password"
              autocomplete="new-password"
              :minlength="minimumLength"
              required
              size="lg"
            />
          </label>
          <label class="grid gap-1 text-xs text-muted">
            {{ messages.auth.value.confirmPassword }}
            <AppInput
              v-model="confirmation"
              type="password"
              autocomplete="new-password"
              :minlength="minimumLength"
              required
              size="lg"
            />
          </label>
          <p v-if="error" class="m-0 text-xs text-error" role="alert">{{ error }}</p>
          <AppButton type="submit" color="primary" variant="solid" size="lg" :loading="pending">
            {{ messages.auth.value.updatePassword }}
          </AppButton>
        </form>
        <RouterLink
          to="/auth/sign-in"
          class="mt-5 block text-center text-xs text-muted underline underline-offset-4"
        >
          {{ messages.auth.value.backToSignIn }}
        </RouterLink>
      </section>
    </main>
  </PublicShell>
</template>
