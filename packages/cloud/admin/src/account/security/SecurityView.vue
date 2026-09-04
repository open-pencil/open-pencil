<script setup lang="ts">
import { cloudAdminAPI } from '#admin/api/client'
import { AppButton, AppInput } from '@open-pencil/ui'
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import { computed, ref } from 'vue'

import { cloudQueryKeys } from '#admin/app/query/keys'
import { authenticationMethodsQueryOptions, discoveryQueryOptions } from '#admin/app/query/options'
import ConfirmDialog from '#admin/components/dialog/ConfirmDialog.vue'
import PublicShell from '#admin/components/layout/PublicShell.vue'
import AsyncBoundary from '#admin/components/feedback/AsyncBoundary.vue'
import { useCloudI18n } from '#admin/i18n/use'
import {
  AccountSecurityError,
  changeAccountPassword,
  startAccountSocialLink,
  unlinkAccountMethod
} from './service'

const messages = useCloudI18n()
const queryClient = useQueryClient()
const methods = useQuery(authenticationMethodsQueryOptions())
const discovery = useQuery(discoveryQueryOptions())
const currentPassword = ref('')
const newPassword = ref('')
const confirmation = ref('')
const formError = ref('')
const passwordChanged = ref(false)
const addPasswordSent = ref(false)
const pendingUnlinkMethod = ref<{ id: string; provider: 'credential' | 'google' | 'apple' }>()
const hasPassword = computed(() =>
  methods.data.value?.methods.some((method) => method.provider === 'credential')
)
const minimumLength = computed(
  () => discovery.data.value?.authentication.emailPassword?.minimumPasswordLength ?? 15
)

function providerLabel(provider: 'credential' | 'google' | 'apple'): string {
  if (provider === 'credential') return messages.account.value.passwordMethod
  return provider === 'google'
    ? messages.account.value.googleMethod
    : messages.account.value.appleMethod
}

function errorMessage(error: unknown): string {
  if (!(error instanceof AccountSecurityError)) return messages.errors.value.credentialUnknown
  if (error.code === 'current_password_invalid') return messages.errors.value.currentPasswordInvalid
  if (error.code === 'password_too_short') {
    return messages.errors.value.passwordTooShort({ count: minimumLength.value })
  }
  if (error.code === 'password_too_long') return messages.errors.value.passwordTooLong
  if (error.code === 'last_method') return messages.errors.value.lastAuthenticationMethod
  if (error.code === 'session_not_fresh') return messages.errors.value.sessionNotFresh
  return messages.errors.value.credentialUnknown
}

const changePassword = useMutation({
  mutationFn: () => changeAccountPassword(currentPassword.value, newPassword.value),
  onSuccess() {
    currentPassword.value = ''
    newPassword.value = ''
    confirmation.value = ''
    passwordChanged.value = true
  },
  onError(error) {
    formError.value = errorMessage(error)
  }
})

const unlink = useMutation({
  mutationFn: unlinkAccountMethod,
  async onSuccess() {
    await queryClient.invalidateQueries({ queryKey: cloudQueryKeys.authenticationMethods })
  },
  onError(error) {
    formError.value = errorMessage(error)
  }
})

function confirmUnlink(): void {
  const method = pendingUnlinkMethod.value
  if (!method) return
  unlink.mutate(method.id, {
    onSuccess() {
      pendingUnlinkMethod.value = undefined
    }
  })
}

async function submitPassword(): Promise<void> {
  formError.value = ''
  passwordChanged.value = false
  if (newPassword.value !== confirmation.value) {
    formError.value = messages.errors.value.passwordMismatch
    return
  }
  await changePassword.mutateAsync().catch(() => undefined)
}

async function addPassword(): Promise<void> {
  const email = queryClient.getQueryData<{ user: { email: string } }>(cloudQueryKeys.account)?.user
    .email
  if (!email) return
  try {
    await cloudAdminAPI.requestPasswordReset(
      email,
      new URL('/auth/reset-password', globalThis.location.origin).href
    )
    passwordChanged.value = false
    addPasswordSent.value = true
    formError.value = ''
  } catch (error) {
    formError.value = errorMessage(error)
  }
}

function linkProvider(provider: 'google' | 'apple'): void {
  const callbackURL = new URL('/app/account/security?linked=1', globalThis.location.origin).href
  void startAccountSocialLink(provider, callbackURL).catch((error) => {
    formError.value = errorMessage(error)
  })
}
</script>

<template>
  <PublicShell>
    <main class="mx-auto w-full max-w-3xl px-5 py-12">
      <div class="mb-8">
        <RouterLink to="/app" class="text-xs text-muted underline underline-offset-4">
          {{ messages.common.value.back }}
        </RouterLink>
        <h1 class="mb-0 mt-3 text-3xl font-semibold tracking-tight">
          {{ messages.account.value.securityTitle }}
        </h1>
        <p class="mt-2 text-sm text-muted">{{ messages.account.value.securityDescription }}</p>
      </div>

      <AsyncBoundary
        :pending="methods.isPending.value"
        :error="methods.isError.value"
        :loading-label="messages.common.value.loading"
        :error-label="messages.errors.value.network"
        :retry-label="messages.common.value.retry"
        @retry="methods.refetch()"
      >
        <section class="rounded-xl border border-border bg-panel p-6">
          <h2 class="m-0 text-lg font-semibold">{{ messages.account.value.signInMethods }}</h2>
          <div class="mt-4 grid gap-3">
            <article
              v-for="method in methods.data.value?.methods ?? []"
              :key="method.id"
              class="flex items-center justify-between gap-4 rounded-lg border border-border px-4 py-3"
            >
              <div>
                <p class="m-0 text-sm font-medium">{{ providerLabel(method.provider) }}</p>
                <p class="mb-0 mt-1 text-xs text-muted">
                  {{ messages.account.value.methodConnected }}
                </p>
              </div>
              <AppButton
                v-if="method.canUnlink"
                variant="ghost"
                size="xs"
                :loading="unlink.isPending.value"
                @click="pendingUnlinkMethod = { id: method.id, provider: method.provider }"
              >
                {{ messages.account.value.unlinkMethod }}
              </AppButton>
            </article>
          </div>
          <div class="mt-4 flex flex-wrap gap-2">
            <AppButton v-if="!hasPassword" variant="outline" @click="addPassword">
              {{ messages.account.value.addPassword }}
            </AppButton>
            <AppButton
              v-for="provider in methods.data.value?.availableSocialProviders ?? []"
              :key="provider"
              variant="outline"
              @click="linkProvider(provider)"
            >
              {{ messages.account.value.linkProvider({ provider: providerLabel(provider) }) }}
            </AppButton>
          </div>
          <p v-if="addPasswordSent" class="mb-0 mt-4 text-xs text-success" role="status">
            {{ messages.account.value.addPasswordEmailSent }}
          </p>
        </section>

        <section v-if="hasPassword" class="mt-6 rounded-xl border border-border bg-panel p-6">
          <h2 class="m-0 text-lg font-semibold">{{ messages.account.value.changePassword }}</h2>
          <p class="mt-2 text-xs text-muted">
            {{ messages.account.value.changePasswordDescription }}
          </p>
          <form class="mt-5 grid gap-3" @submit.prevent="submitPassword">
            <label class="grid gap-1 text-xs text-muted">
              {{ messages.account.value.currentPassword }}
              <AppInput
                v-model="currentPassword"
                type="password"
                autocomplete="current-password"
                required
              />
            </label>
            <label class="grid gap-1 text-xs text-muted">
              {{ messages.auth.value.newPassword }}
              <AppInput
                v-model="newPassword"
                type="password"
                autocomplete="new-password"
                :minlength="minimumLength"
                required
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
              />
            </label>
            <p v-if="formError" class="m-0 text-xs text-error" role="alert">{{ formError }}</p>
            <p v-if="passwordChanged" class="m-0 text-xs text-success" role="status">
              {{ messages.account.value.passwordChanged }}
            </p>
            <AppButton
              type="submit"
              color="primary"
              variant="solid"
              :loading="changePassword.isPending.value"
            >
              {{ messages.account.value.updatePassword }}
            </AppButton>
          </form>
        </section>
      </AsyncBoundary>
      <ConfirmDialog
        :open="Boolean(pendingUnlinkMethod)"
        :title="messages.account.value.unlinkTitle"
        :description="messages.account.value.unlinkDescription"
        :confirm-label="messages.account.value.unlinkMethod"
        :cancel-label="messages.common.value.cancel"
        :reason-label="messages.common.value.optional"
        :loading="unlink.isPending.value"
        @update:open="!$event && (pendingUnlinkMethod = undefined)"
        @confirm="confirmUnlink"
      />
    </main>
  </PublicShell>
</template>
