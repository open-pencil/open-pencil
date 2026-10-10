<script setup lang="ts">
import { computed } from 'vue'

import DocumentEntry from '@/components/home/document/DocumentEntry.vue'
import AppButton from '@/components/ui/button/AppButton.vue'
import IconButton from '@/components/ui/button/IconButton.vue'
import AppAlert from '@/components/ui/feedback/AppAlert.vue'
import AppBadge from '@/components/ui/feedback/AppBadge.vue'
import AppPlaceholder from '@/components/ui/feedback/AppPlaceholder.vue'
import AppProgress from '@/components/ui/feedback/AppProgress.vue'
import Tip from '@/components/ui/overlay/Tip.vue'
import SegmentedControl from '@/components/ui/select/SegmentedControl.vue'

import CloudSyncIcon from './CloudSyncIcon.vue'
import type { CloudDocumentRow } from './types'

/**
 * One Cloud workspace on the home tab: its files with where each stands against the server, how
 * much of the workspace's storage they use, and what needs attention.
 */
const {
  title,
  subtitle,
  role = null,
  documents,
  usage = null,
  state = 'ready'
} = defineProps<{
  title: string
  subtitle?: string
  /** The person's role in the workspace, when it is a workspace rather than a shared list. */
  role?: string | null
  documents: CloudDocumentRow[]
  usage?: { usedBytes: number; totalBytes: number | null } | null
  state?: 'loading' | 'ready' | 'offline' | 'error'
}>()

const view = defineModel<'grid' | 'list'>('view', { default: 'grid' })
const emit = defineEmits<{
  open: [document: CloudDocumentRow]
  newDesign: []
  refresh: []
  reviewConflicts: []
}>()

const conflicts = computed(() => documents.filter((document) => document.sync === 'conflict'))
const formatBytes = (bytes: number) => {
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let value = bytes
  let unit = 0
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024
    unit += 1
  }
  return `${value >= 10 || unit === 0 ? Math.round(value) : value.toFixed(1)} ${units[unit]}`
}
const usageLabel = computed(() => {
  if (!usage) return null
  return usage.totalBytes === null
    ? `${formatBytes(usage.usedBytes)} used`
    : `${formatBytes(usage.usedBytes)} of ${formatBytes(usage.totalBytes)}`
})
const metadata = (document: CloudDocumentRow) =>
  document.editedBy ? `${document.editedAt} · ${document.editedBy}` : document.editedAt
</script>

<template>
  <section class="flex min-w-0 flex-col gap-4">
    <header class="flex flex-wrap items-start gap-x-4 gap-y-2">
      <div class="min-w-0 flex-1">
        <div class="flex items-center gap-2">
          <h1 class="truncate text-base font-semibold">{{ title }}</h1>
          <AppBadge v-if="role">{{ role }}</AppBadge>
        </div>
        <div v-if="subtitle || usageLabel" class="mt-1 flex items-center gap-2 text-xs text-muted">
          <span v-if="subtitle">{{ subtitle }}</span>
          <span v-if="subtitle && usageLabel" aria-hidden="true">·</span>
          <template v-if="usage && usage.totalBytes !== null && usageLabel">
            <AppProgress
              :amount="{ value: usage.usedBytes, max: usage.totalBytes }"
              :aria-label="`Workspace storage, ${usageLabel}`"
              :ui="{ root: 'w-16' }"
            />
            <span>{{ usageLabel }}</span>
          </template>
          <span v-else-if="usageLabel">{{ usageLabel }}</span>
        </div>
      </div>
      <div class="flex items-center gap-1">
        <IconButton label="Refresh" class="size-7" @click="emit('refresh')">
          <icon-lucide-refresh-cw class="size-3.5" />
        </IconButton>
        <SegmentedControl
          v-model="view"
          required
          label="View"
          :options="[
            { value: 'grid', label: 'Grid' },
            { value: 'list', label: 'List' }
          ]"
        >
          <template #option="{ option }">
            <icon-lucide-layout-grid v-if="option.value === 'grid'" class="size-3.5" />
            <icon-lucide-list v-else class="size-3.5" />
          </template>
        </SegmentedControl>
      </div>
    </header>

    <AppAlert
      v-if="state === 'offline'"
      tone="info"
      heading="You're offline"
      description="These are the files saved on this device. Changes upload when you reconnect."
    />
    <AppAlert
      v-else-if="state === 'error'"
      tone="error"
      heading="Couldn't load this workspace"
      description="The server didn't answer. Files saved on this device are still listed."
    >
      <template #actions>
        <AppButton size="sm" variant="outline" @click="emit('refresh')">Try again</AppButton>
      </template>
    </AppAlert>
    <AppAlert
      v-if="conflicts.length"
      tone="warning"
      :heading="
        conflicts.length === 1
          ? `“${conflicts[0]?.name}” was changed in two places`
          : `${conflicts.length} files were changed in two places`
      "
      description="Someone saved a newer version while you had unsent changes. Nothing is lost until you choose."
    >
      <template #actions>
        <AppButton size="sm" variant="outline" @click="emit('reviewConflicts')">Review</AppButton>
      </template>
    </AppAlert>

    <div
      v-if="state === 'loading'"
      class="grid grid-cols-1 gap-x-5 gap-y-6 sm:grid-cols-[repeat(auto-fill,minmax(200px,1fr))]"
      aria-label="Loading files"
    >
      <div v-for="index in 4" :key="index" class="min-w-0 animate-pulse motion-reduce:animate-none">
        <div class="aspect-video rounded-lg border border-border bg-panel-field" />
        <div class="mt-2 h-3 w-2/3 rounded bg-panel-field" />
        <div class="mt-1.5 h-2.5 w-1/3 rounded bg-panel-field" />
      </div>
    </div>

    <AppPlaceholder
      v-else-if="documents.length === 0"
      size="page"
      label-as="h2"
      :label="`No files in ${title} yet`"
      description="Create a design here, or save an open file to this workspace from the File menu."
      :ui="{ root: 'rounded-lg border border-dashed border-border py-10' }"
    >
      <template #icon><icon-lucide-layers class="size-5" /></template>
      <template #action>
        <AppButton color="primary" variant="solid" @click="emit('newDesign')">
          <template #leading><icon-lucide-plus class="size-3.5" /></template>
          New design
        </AppButton>
      </template>
    </AppPlaceholder>

    <div
      v-else
      :class="
        view === 'grid'
          ? 'grid grid-cols-1 gap-x-5 gap-y-6 sm:grid-cols-[repeat(auto-fill,minmax(200px,1fr))]'
          : 'overflow-hidden rounded-lg border border-border'
      "
    >
      <DocumentEntry
        v-for="document in documents"
        :key="document.id"
        :view="view"
        :name="document.name"
        :metadata="metadata(document)"
        :previewURL="document.previewURL"
        @open="emit('open', document)"
      >
        <template #status>
          <Tip v-if="document.permission === 'view'" label="You can view this file">
            <icon-lucide-eye class="size-3" role="img" aria-label="View only" />
          </Tip>
          <Tip v-if="document.shared" label="Shared with people outside the workspace">
            <icon-lucide-users class="size-3" role="img" aria-label="Shared" />
          </Tip>
          <CloudSyncIcon :state="document.sync" />
        </template>
      </DocumentEntry>
    </div>
  </section>
</template>
