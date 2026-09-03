<script setup lang="ts">
import { AppButton } from '@open-pencil/ui'
import { useQuery } from '@tanstack/vue-query'
import { computed, ref } from 'vue'
import { useRoute } from 'vue-router'

import { discoveryQueryOptions } from '#admin/app/query/options'
import PublicShell from '#admin/components/layout/PublicShell.vue'
import { useCloudI18n } from '#admin/i18n/use'
import { createCredentialAuthService } from './credentials/service'

const messages = useCloudI18n()
const route = useRoute()
const discovery = useQuery(discoveryQueryOptions())
const pending = ref(false)
const resent = ref(false)
const error = ref(false)
const state = computed(() => (route.query.state === 'verified' ? 'verified' : 'sent'))
const email = computed(() => (typeof route.query.email === 'string' ? route.query.email : ''))

async function resend(): Promise<void> {
  const instance = discovery.data.value
  if (!instance || !email.value) return
  pending.value = true
  error.value = false
  try {
    await createCredentialAuthService(instance).resendVerification(
      email.value,
      new URL('/auth/verify-email?state=verified', location.origin).href
    )
    resent.value = true
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
      <section
        class="w-full max-w-md rounded-xl border border-border bg-panel p-6 text-center shadow-2xl"
      >
        <h1 class="m-0 text-xl font-semibold">
          {{
            state === 'verified'
              ? messages.auth.value.emailVerifiedTitle
              : messages.auth.value.checkEmailTitle
          }}
        </h1>
        <p class="mt-3 text-sm leading-6 text-muted">
          {{
            state === 'verified'
              ? messages.auth.value.emailVerifiedDescription
              : messages.auth.value.checkEmailDescription
          }}
        </p>
        <template v-if="state === 'sent' && email">
          <p v-if="resent" class="text-xs text-success" role="status">
            {{ messages.auth.value.verificationResent }}
          </p>
          <p v-if="error" class="text-xs text-error" role="alert">
            {{ messages.errors.value.credentialUnknown }}
          </p>
          <AppButton variant="outline" size="md" :loading="pending" @click="resend">
            {{ messages.auth.value.resendVerification }}
          </AppButton>
        </template>
        <RouterLink
          to="/auth/sign-in"
          class="mt-5 block text-xs text-muted underline underline-offset-4"
        >
          {{ messages.auth.value.backToSignIn }}
        </RouterLink>
      </section>
    </main>
  </PublicShell>
</template>
