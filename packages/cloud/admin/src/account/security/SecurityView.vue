<script setup lang="ts">
import { AppButton, AppInput } from '@open-pencil/ui'

import ConfirmDialog from '#admin/components/dialog/ConfirmDialog.vue'
import AsyncBoundary from '#admin/components/feedback/AsyncBoundary.vue'
import PublicShell from '#admin/components/layout/PublicShell.vue'
import { useAccountSecurity } from './useAccountSecurity'

const {
  addPassword,
  addPasswordSent,
  changePassword,
  confirmation,
  currentPassword,
  formError,
  hasPassword,
  linkProvider,
  messages,
  methods,
  minimumLength,
  newPassword,
  passwordChanged,
  pendingUnlinkMethod,
  providerLabel,
  submitPassword,
  unlink
} = useAccountSecurity()

function confirmUnlink(): void {
  const method = pendingUnlinkMethod.value
  if (method) unlink.mutate(method.id)
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
                @click="pendingUnlinkMethod = method"
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
