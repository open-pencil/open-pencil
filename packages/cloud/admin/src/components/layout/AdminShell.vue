<script setup lang="ts">
import { AppButton } from '@open-pencil/ui'
import { useQueryClient } from '@tanstack/vue-query'

import CloudPreferences from '#admin/components/preferences/CloudPreferences.vue'
import { discoveryQueryOptions } from '#admin/app/query/options'
import { endCloudSession } from '#admin/auth/client'
import { useCloudI18n } from '#admin/i18n/use'

const messages = useCloudI18n()
const queryClient = useQueryClient()
const links = [
  ['admin-enrollment', 'enrollment'],
  ['admin-users', 'users'],
  ['admin-email', 'email'],
  ['admin-audit', 'audit'],
  ['admin-operations', 'operations']
] as const

async function signOut(): Promise<void> {
  const discovery = await queryClient.ensureQueryData(discoveryQueryOptions())
  await endCloudSession(discovery)
}
</script>

<template>
  <div class="min-h-screen bg-canvas text-surface md:grid md:grid-cols-[220px_1fr]">
    <aside class="border-b border-border bg-panel p-4 md:border-r md:border-b-0 md:p-5">
      <div class="mb-5 flex items-center justify-between gap-3 text-xs font-semibold md:mb-8">
        <RouterLink to="/" class="text-surface no-underline">{{
          messages.common.value.productName
        }}</RouterLink>
        <div class="flex items-center gap-1">
          <CloudPreferences />
          <AppButton variant="ghost" size="xs" @click="signOut">{{
            messages.common.value.signOut
          }}</AppButton>
        </div>
      </div>
      <nav
        class="flex gap-1 overflow-x-auto md:flex-col"
        :aria-label="messages.common.value.administrationNavigation"
      >
        <RouterLink
          v-for="[name, label] in links"
          :key="name"
          :to="{ name }"
          class="shrink-0 rounded-md px-3 py-2 text-xs text-muted no-underline hover:bg-hover hover:text-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
          active-class="!bg-accent/15 !text-surface"
        >
          {{ messages.admin.value[label] }}
        </RouterLink>
      </nav>
    </aside>
    <main class="mx-auto w-full max-w-6xl p-5 md:p-8"><RouterView /></main>
  </div>
</template>
