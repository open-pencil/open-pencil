<script setup lang="ts">
import { AppButton } from '@open-pencil/ui'
import { useQueryClient } from '@tanstack/vue-query'

import { discoveryQueryOptions } from '#admin/app/query/options'
import { endCloudSession } from '#admin/auth/client'
import PublicShell from '#admin/components/layout/PublicShell.vue'
import { useCloudI18n } from '#admin/i18n/use'

const { state } = defineProps<{ state: 'rejected' | 'revoked' }>()
const messages = useCloudI18n()
const queryClient = useQueryClient()

async function signOut(): Promise<void> {
  const discovery = await queryClient.ensureQueryData(discoveryQueryOptions())
  await endCloudSession(discovery)
}
</script>

<template>
  <PublicShell>
    <main class="mx-auto grid min-h-[calc(100vh-7rem)] max-w-2xl place-items-center p-5">
      <section class="w-full rounded-xl border border-border bg-panel p-6 text-center shadow-2xl">
        <h1 class="m-0 text-2xl font-semibold">
          {{
            state === 'rejected'
              ? messages.account.value.rejectedTitle
              : messages.account.value.revokedTitle
          }}
        </h1>
        <p class="mx-auto mt-3 max-w-lg text-sm leading-6 text-muted">
          {{
            state === 'rejected'
              ? messages.account.value.rejectedDescription
              : messages.account.value.revokedDescription
          }}
        </p>
        <AppButton class="mt-6" variant="ghost" size="md" @click="signOut">
          {{ messages.common.value.signOut }}
        </AppButton>
      </section>
    </main>
  </PublicShell>
</template>
