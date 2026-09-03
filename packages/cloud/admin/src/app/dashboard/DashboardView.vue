<script setup lang="ts">
import { AppLink } from '@open-pencil/ui'
import { useQuery } from '@tanstack/vue-query'

import { editorURL } from '#admin/app/editor-url'
import { discoveryQueryOptions, workspacesQueryOptions } from '#admin/app/query/options'
import AsyncBoundary from '#admin/components/feedback/AsyncBoundary.vue'
import EmptyState from '#admin/components/feedback/EmptyState.vue'
import PublicShell from '#admin/components/layout/PublicShell.vue'
import { useCloudI18n } from '#admin/i18n/use'

const messages = useCloudI18n()
const discovery = useQuery(discoveryQueryOptions())
const workspaces = useQuery(workspacesQueryOptions())
</script>

<template>
  <PublicShell>
    <main class="mx-auto min-h-[calc(100vh-7rem)] w-full max-w-6xl px-5 py-12">
      <section class="rounded-xl border border-border bg-panel p-6 sm:p-8">
        <p class="mb-2 text-xs font-medium text-component">
          {{ messages.account.value.readyLabel }}
        </p>
        <h1 class="m-0 text-3xl font-semibold tracking-tight">
          {{ messages.account.value.dashboardTitle }}
        </h1>
        <p class="mt-3 max-w-2xl text-sm leading-6 text-muted">
          {{ messages.account.value.dashboardDescription }}
        </p>
        <div class="mt-6 flex flex-wrap gap-2">
          <AppLink
            v-if="discovery.data.value"
            :href="editorURL(discovery.data.value)"
            color="primary"
            variant="solid"
            size="lg"
          >
            {{ messages.public.value.openEditor }}
          </AppLink>
        </div>
      </section>

      <section class="mt-8">
        <h2 class="text-lg font-semibold">{{ messages.account.value.workspacesTitle }}</h2>
        <AsyncBoundary
          :pending="workspaces.isPending.value"
          :error="workspaces.isError.value"
          :loading-label="messages.common.value.loading"
          :error-label="messages.errors.value.network"
          :retry-label="messages.common.value.retry"
          @retry="workspaces.refetch()"
        >
          <div
            v-if="workspaces.data.value?.workspaces.length"
            class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
          >
            <article
              v-for="workspace in workspaces.data.value.workspaces"
              :key="workspace.id"
              class="rounded-lg border border-border bg-panel p-5"
            >
              <h3 class="m-0 text-sm font-semibold">{{ workspace.name }}</h3>
              <p class="mb-0 mt-2 text-xs text-muted">
                {{ messages.account.value.workspaceRole({ role: workspace.role }) }}
              </p>
            </article>
          </div>
          <EmptyState
            v-else
            :label="`${messages.account.value.noWorkspacesTitle}. ${messages.account.value.noWorkspacesDescription}`"
          />
        </AsyncBoundary>
      </section>
    </main>
  </PublicShell>
</template>
