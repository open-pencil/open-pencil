<script setup lang="ts">
import { AppButton } from '@open-pencil/ui'
import { useQuery } from '@tanstack/vue-query'
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { discoveryQueryOptions } from '#admin/app/query/options'
import AsyncError from '#admin/components/feedback/AsyncError.vue'
import PublicShell from '#admin/components/layout/PublicShell.vue'
import CredentialForm from '#admin/auth/credentials/CredentialForm.vue'
import { useOAuthCallback } from '#admin/auth/useOAuthCallback'
import { useSignIn } from '#admin/auth/useSignIn'
import { useCloudI18n } from '#admin/i18n/use'

const { intent } = defineProps<{ intent: 'sign-in' | 'sign-up' }>()
const messages = useCloudI18n()
const route = useRoute()
const router = useRouter()
const callback = useOAuthCallback()
const discovery = useQuery(discoveryQueryOptions())
const safeRedirect = computed(() => {
  const value = route.query.redirect
  return typeof value === 'string' && value.startsWith('/') && !value.startsWith('//') ? value : '/'
})
const signIn = useSignIn(
  () => discovery.data.value,
  intent,
  () => safeRedirect.value
)
const callbackMessage = computed(() => {
  if (callback.value.kind === 'cancelled') return messages.errors.value.signInCancelled
  if (callback.value.kind === 'enrollment-closed') return messages.errors.value.enrollmentClosed
  if (callback.value.kind === 'provider-error') return messages.errors.value.providerError
  return ''
})
const isSignUp = computed(() => intent === 'sign-up')
const credentials = computed(() => discovery.data.value?.authentication.emailPassword)
const hasSocialProviders = computed(() =>
  Boolean(discovery.data.value?.authentication.socialProviders.length)
)

function completeAuthentication(): void {
  void router.replace(safeRedirect.value)
}

function showVerification(email: string): void {
  void router.replace({ name: 'verify-email', query: { state: 'sent', email } })
}

function providerLabel(provider: 'google' | 'apple'): string {
  return provider === 'google'
    ? messages.auth.value.continueGoogle
    : messages.auth.value.continueApple
}
</script>

<template>
  <PublicShell>
    <main class="grid place-items-center p-5">
      <section class="w-full max-w-md rounded-xl border border-border bg-panel p-6 shadow-2xl">
        <h1 class="m-0 text-xl font-semibold">
          {{ isSignUp ? messages.auth.value.signUpTitle : messages.auth.value.signInTitle }}
        </h1>
        <AsyncError v-if="callbackMessage" class="mt-5" :title="callbackMessage" />
        <CredentialForm
          v-if="discovery.data.value && credentials?.signIn && (!isSignUp || credentials.signUp)"
          class="mt-5"
          :discovery="discovery.data.value"
          :intent="intent"
          @verified="completeAuthentication"
          @verification-required="showVerification"
        />
        <div v-if="credentials?.signIn && hasSocialProviders" class="my-5 flex items-center gap-3">
          <span class="h-px flex-1 bg-border" />
          <span class="text-xs text-muted">{{ messages.auth.value.or }}</span>
          <span class="h-px flex-1 bg-border" />
        </div>
        <div v-if="hasSocialProviders" class="mt-5 grid gap-2">
          <AppButton
            v-for="provider in discovery.data.value?.authentication.socialProviders ?? []"
            :key="provider"
            color="neutral"
            variant="solid"
            size="lg"
            :loading="signIn.mutation.isPending.value"
            @click="signIn.start(provider)"
          >
            {{ providerLabel(provider) }}
          </AppButton>
        </div>
        <AsyncError
          v-else-if="!credentials?.signIn"
          class="mt-5"
          :title="messages.auth.value.noProviders"
        />
        <p
          v-if="isSignUp && discovery.data.value?.authentication.enrollmentMode === 'approval'"
          class="mb-0 mt-4 text-center text-xs leading-5 text-muted"
        >
          {{ messages.auth.value.approvalDisclosure }}
        </p>
        <AsyncError
          v-if="signIn.mutation.isError.value"
          class="mt-3"
          :title="messages.errors.value.providerError"
          :retry-label="messages.common.value.retry"
          @retry="signIn.mutation.reset()"
        />
        <p class="mb-0 mt-5 text-center text-xs text-muted">
          {{ isSignUp ? messages.auth.value.haveAccount : messages.auth.value.needAccount }}
          <RouterLink
            :to="isSignUp ? { name: 'sign-in' } : { name: 'sign-up' }"
            class="font-medium text-surface underline underline-offset-4"
          >
            {{ isSignUp ? messages.auth.value.signIn : messages.auth.value.signUp }}
          </RouterLink>
        </p>
      </section>
    </main>
  </PublicShell>
</template>
