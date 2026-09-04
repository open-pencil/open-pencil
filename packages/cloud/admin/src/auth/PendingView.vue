<script setup lang="ts">
import { AppButton } from '@open-pencil/ui'
import { useQuery, useQueryClient } from '@tanstack/vue-query'

import { discoveryQueryOptions } from '#admin/app/query/options'
import { endCloudSession } from '#admin/auth/client'
import PublicShell from '#admin/components/layout/PublicShell.vue'
import { useCloudI18n } from '#admin/i18n/use'

const messages = useCloudI18n()
const queryClient = useQueryClient()
const discovery = useQuery(discoveryQueryOptions())

async function signOut(): Promise<void> {
  const instance = await queryClient.ensureQueryData(discoveryQueryOptions())
  await endCloudSession(instance)
}
</script>

<template>
  <PublicShell>
    <main class="mx-auto grid max-w-2xl place-items-center p-5">
      <section class="w-full rounded-xl border border-border bg-panel p-6 text-center shadow-2xl">
        <p class="mb-2 text-xs font-medium text-component">
          {{ messages.common.value.productName }}
        </p>
        <h1 class="m-0 text-2xl font-semibold">{{ messages.account.value.pendingTitle }}</h1>
        <p class="mx-auto mt-3 max-w-lg text-sm leading-6 text-muted">
          {{ messages.account.value.pendingDescription }}
        </p>
        <div class="mt-6 flex justify-center gap-2">
          <AppButton variant="outline" size="md" @click="$router.go(0)">
            {{ messages.account.value.checkAgain }}
          </AppButton>
          <AppButton variant="ghost" size="md" @click="signOut">
            {{ messages.common.value.signOut }}
          </AppButton>
        </div>
      </section>
    </main>
  </PublicShell>
</template>
