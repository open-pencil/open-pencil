<script setup lang="ts">
import { AppButton, AppInput } from '@open-pencil/ui'
import { useQuery } from '@tanstack/vue-query'
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { createCloudAuthClient } from '@open-pencil/cloud/client'

import { cloudAdminAPI } from '#admin/api/client'
import { cloudQueryKeys } from '#admin/app/query/keys'
import { discoveryQueryOptions } from '#admin/app/query/options'
import { queryClient } from '#admin/app/query/client'
import PublicShell from '#admin/components/layout/PublicShell.vue'
import { useCloudI18n } from '#admin/i18n/use'

const messages = useCloudI18n()
const discovery = useQuery(discoveryQueryOptions())
const route = useRoute()
const router = useRouter()
const code = ref('')
const recoveryCode = ref('')
const pending = ref(false)
const error = ref(false)

function redirectPath(): string {
  const value = route.query.redirect
  return typeof value === 'string' && value.startsWith('/') && !value.startsWith('//')
    ? value
    : '/admin'
}

async function verify(kind: 'totp' | 'recovery' | 'passkey'): Promise<void> {
  pending.value = true
  error.value = false
  try {
    if (kind === 'passkey') {
      const instance = discovery.data.value
      if (!instance) throw new Error('Cloud discovery is unavailable')
      const result = await createCloudAuthClient(instance).signIn.passkey()
      if (result.error) throw new Error(result.error.message)
    } else {
      const instance = discovery.data.value
      if (!instance) throw new Error('Cloud discovery is unavailable')
      const auth = createCloudAuthClient(instance)
      const session = await auth.getSession()
      if (session.data) {
        if (kind === 'totp') await cloudAdminAPI.verifyTOTP(code.value)
        else await cloudAdminAPI.verifyRecoveryCode(recoveryCode.value)
      } else {
        const result =
          kind === 'totp'
            ? await auth.twoFactor.verifyTotp({ code: code.value, trustDevice: false })
            : await auth.twoFactor.verifyBackupCode({
                code: recoveryCode.value,
                trustDevice: false
              })
        if (result.error) throw new Error(result.error.message)
      }
    }
    await queryClient.invalidateQueries({ queryKey: cloudQueryKeys.mfa })
    await router.replace(redirectPath())
  } catch {
    error.value = true
  } finally {
    pending.value = false
  }
}
</script>

<template>
  <PublicShell>
    <main class="mx-auto grid w-full max-w-md place-items-center p-5">
      <section class="w-full rounded-xl border border-border bg-panel p-6 shadow-2xl">
        <h1 class="m-0 text-xl font-semibold">{{ messages.auth.value.mfaChallengeTitle }}</h1>
        <p class="mt-2 text-sm text-muted">{{ messages.auth.value.mfaChallengeDescription }}</p>
        <AppButton
          v-if="discovery.data.value?.authentication.mfa?.passkeys"
          class="mt-5 w-full"
          variant="outline"
          :loading="pending"
          @click="verify('passkey')"
        >
          {{ messages.account.value.verifyWithPasskey }}
        </AppButton>
        <form class="mt-5 grid gap-3" @submit.prevent="verify('totp')">
          <label class="grid gap-1 text-xs text-muted">
            {{ messages.account.value.verificationCode }}
            <AppInput v-model="code" inputmode="numeric" autocomplete="one-time-code" required />
          </label>
          <AppButton type="submit" color="primary" variant="solid" :loading="pending">
            {{ messages.account.value.verifyMFA }}
          </AppButton>
        </form>
        <form
          class="mt-5 grid gap-3 border-t border-border pt-5"
          @submit.prevent="verify('recovery')"
        >
          <label class="grid gap-1 text-xs text-muted">
            {{ messages.account.value.recoveryCode }}
            <AppInput v-model="recoveryCode" autocomplete="one-time-code" required />
          </label>
          <AppButton type="submit" variant="outline" :loading="pending">
            {{ messages.account.value.useRecoveryCode }}
          </AppButton>
        </form>
        <p v-if="error" class="mb-0 mt-4 text-xs text-error" role="alert">
          {{ messages.errors.value.mfaInvalidCode }}
        </p>
      </section>
    </main>
  </PublicShell>
</template>
