<script setup lang="ts">
import { AppButton } from '@open-pencil/ui'
import { useQuery, useQueryClient } from '@tanstack/vue-query'
import { computed } from 'vue'
import { useRoute } from 'vue-router'

import { accountQueryOptions, discoveryQueryOptions } from '#admin/app/query/options'
import { endCloudSession } from '#admin/auth/client'
import CloudPreferences from '#admin/components/preferences/CloudPreferences.vue'
import { useCloudI18n } from '#admin/i18n/use'

const messages = useCloudI18n()
const route = useRoute()
const queryClient = useQueryClient()
const account = useQuery(accountQueryOptions())
const isSignedIn = computed(() => account.isSuccess.value)
const isAdmin = computed(
  () => account.data.value?.state === 'active' && account.data.value.user.deploymentRole === 'admin'
)

async function signOut(): Promise<void> {
  const discovery = await queryClient.ensureQueryData(discoveryQueryOptions())
  await endCloudSession(discovery)
}
</script>

<template>
  <div class="min-h-screen bg-canvas text-surface">
    <header class="border-b border-border bg-panel/90 backdrop-blur">
      <nav
        class="mx-auto flex min-h-14 max-w-6xl items-center justify-between gap-2 px-4 sm:px-5"
        :aria-label="messages.common.value.primaryNavigation"
      >
        <RouterLink
          to="/"
          class="shrink-0 font-semibold whitespace-nowrap text-surface no-underline"
        >
          {{ messages.common.value.productName }}
        </RouterLink>
        <div class="flex items-center gap-1">
          <CloudPreferences />
          <template v-if="isSignedIn">
            <RouterLink
              v-if="isAdmin"
              to="/admin"
              class="rounded-md px-3 py-2 text-xs text-muted no-underline hover:bg-hover hover:text-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
            >
              {{ messages.common.value.administrationNavigation }}
            </RouterLink>
            <AppButton variant="ghost" size="xs" @click="signOut">
              {{ messages.common.value.signOut }}
            </AppButton>
          </template>
          <template v-else>
            <div class="hidden items-center gap-1 sm:flex">
              <RouterLink
                :to="{
                  name: 'sign-in',
                  query: route.query.redirect ? { redirect: route.query.redirect } : {}
                }"
                class="rounded-md px-3 py-2 text-xs text-muted no-underline hover:bg-hover hover:text-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
              >
                {{ messages.auth.value.signIn }}
              </RouterLink>
              <RouterLink
                to="/sign-up"
                class="rounded-md bg-accent px-3 py-2 text-xs font-medium text-white no-underline hover:bg-accent/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
              >
                {{ messages.auth.value.signUp }}
              </RouterLink>
            </div>
          </template>
        </div>
      </nav>
    </header>
    <slot />
    <footer class="border-t border-border px-5 py-6 text-center text-xs text-muted">
      {{ messages.common.value.productName }}
    </footer>
  </div>
</template>
