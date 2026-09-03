<script setup lang="ts">
import { AppButton, AppInput } from '@open-pencil/ui'
import { useQuery } from '@tanstack/vue-query'
import { ref } from 'vue'

import { discoveryQueryOptions } from '#admin/app/query/options'
import PublicShell from '#admin/components/layout/PublicShell.vue'
import { useCloudI18n } from '#admin/i18n/use'
import { createCredentialAuthService } from './credentials/service'

const messages = useCloudI18n()
const discovery = useQuery(discoveryQueryOptions())
const email = ref('')
const sent = ref(false)
const pending = ref(false)
const error = ref(false)

async function submit(): Promise<void> {
  const instance = discovery.data.value
  if (!instance) return
  pending.value = true
  error.value = false
  try {
    await createCredentialAuthService(instance).requestPasswordReset(
      email.value,
      new URL('/auth/reset-password', location.origin).href
    )
    sent.value = true
  } catch {
    error.value = true
  } finally {
    pending.value = false
  }
}
</script>

<template>
  <PublicShell>
    <main class="grid min-h-[calc(100vh-7rem)] place-items-center p-5">
      <section class="w-full max-w-md rounded-xl border border-border bg-panel p-6 shadow-2xl">
        <h1 class="m-0 text-xl font-semibold">{{ messages.auth.value.forgotPasswordTitle }}</h1>
        <p class="mt-2 text-sm leading-6 text-muted">
          {{ sent ? messages.auth.value.resetSent : messages.auth.value.forgotPasswordDescription }}
        </p>
        <form v-if="!sent" class="mt-5 grid gap-3" @submit.prevent="submit">
          <label class="grid gap-1 text-xs text-muted">
            {{ messages.auth.value.email }}
            <AppInput
              v-model="email"
              name="email"
              type="email"
              autocomplete="email"
              required
              size="lg"
            />
          </label>
          <p v-if="error" class="m-0 text-xs text-error" role="alert">
            {{ messages.errors.value.credentialUnknown }}
          </p>
          <AppButton type="submit" color="primary" variant="solid" size="lg" :loading="pending">
            {{ messages.auth.value.sendResetLink }}
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
