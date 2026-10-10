<script setup lang="ts">
import { computed } from 'vue'

import { useCloudMessages, useCommonMessages } from '@open-pencil/vue'

import { formatStorageBytes } from '@/app/storage/format-bytes'
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
  heading,
  subtitle,
  role = null,
  documents,
  usage = null,
  state = 'ready',
  canCreate = false
} = defineProps<{
  heading: string
  subtitle?: string
  /** The person's role in the workspace, when it is a workspace rather than a shared list. */
  role?: string | null
  documents: CloudDocumentRow[]
  usage?: { usedBytes: number; totalBytes: number | null } | null
  state?: 'loading' | 'ready' | 'offline' | 'error'
  /** The person may create designs here. */
  canCreate?: boolean
}>()

const view = defineModel<'grid' | 'list'>('view', { default: 'grid' })
const emit = defineEmits<{
  open: [document: CloudDocumentRow]
  newDesign: []
  refresh: []
  reviewConflicts: []
}>()

const t = useCloudMessages()
const common = useCommonMessages()
const conflicts = computed(() => documents.filter((document) => document.sync === 'conflict'))
const usageLabel = computed(() => {
  if (!usage) return null
  const used = formatStorageBytes(usage.usedBytes)
  return usage.totalBytes === null
    ? t.value.homeUsageUsed({ used })
    : t.value.homeUsageOf({ used, total: formatStorageBytes(usage.totalBytes) })
})
const metadata = (document: CloudDocumentRow) =>
  document.editedBy ? `${document.editedAt} · ${document.editedBy}` : document.editedAt
</script>

<template>
  <section class="flex min-w-0 flex-col gap-4">
    <header class="flex flex-wrap items-start gap-x-4 gap-y-2">
      <div class="min-w-0 flex-1">
        <div class="flex items-center gap-2">
          <h1 class="truncate text-base font-semibold">{{ heading }}</h1>
          <AppBadge v-if="role">{{ role }}</AppBadge>
        </div>
        <div
          v-if="subtitle || usageLabel"
          class="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs whitespace-nowrap text-muted"
        >
          <span v-if="subtitle">{{ subtitle }}</span>
          <span v-if="subtitle && usageLabel" aria-hidden="true">·</span>
          <template v-if="usage && usage.totalBytes !== null && usageLabel">
            <AppProgress
              :amount="{ value: usage.usedBytes, max: usage.totalBytes }"
              :aria-label="t.homeWorkspaceStorage({ usage: usageLabel })"
              :ui="{ root: 'w-16' }"
            />
            <span>{{ usageLabel }}</span>
          </template>
          <span v-else-if="usageLabel">{{ usageLabel }}</span>
        </div>
      </div>
      <div class="flex items-center gap-1">
        <IconButton :label="common.refresh" class="size-7" @click="emit('refresh')">
          <icon-lucide-refresh-cw class="size-3.5" />
        </IconButton>
        <SegmentedControl
          v-model="view"
          required
          :label="t.homeView"
          :options="[
            { value: 'grid', label: t.homeGrid },
            { value: 'list', label: t.homeList }
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
      :heading="t.homeOfflineHeading"
      :description="t.homeOfflineDescription"
    />
    <AppAlert
      v-else-if="state === 'error'"
      tone="error"
      :heading="t.homeLoadFailedHeading"
      :description="t.homeLoadFailedDescription"
    >
      <template #actions>
        <AppButton size="sm" variant="outline" @click="emit('refresh')">{{ t.tryAgain }}</AppButton>
      </template>
    </AppAlert>
    <AppAlert
      v-if="conflicts.length"
      tone="warning"
      :heading="
        conflicts.length === 1
          ? t.changedInTwoPlaces({ name: conflicts[0]?.name ?? '' })
          : t.homeConflicts(conflicts.length)
      "
      :description="t.conflictDescription"
    >
      <template #actions>
        <AppButton size="sm" variant="outline" @click="emit('reviewConflicts')">{{
          t.homeReview
        }}</AppButton>
      </template>
    </AppAlert>

    <div
      v-if="state === 'loading'"
      class="grid grid-cols-1 gap-x-5 gap-y-6 sm:grid-cols-[repeat(auto-fill,minmax(200px,1fr))]"
      :aria-label="t.homeLoadingFiles"
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
      :label="role ? t.homeEmptyWorkspace({ workspace: heading }) : t.homeNothingShared"
      :description="role ? t.homeEmptyWorkspaceDescription : t.homeNothingSharedDescription"
      :ui="{ root: 'rounded-lg border border-dashed border-border py-10' }"
    >
      <template #icon><icon-lucide-layers class="size-5" /></template>
      <template v-if="canCreate" #action>
        <AppButton color="primary" variant="solid" @click="emit('newDesign')">
          <template #leading><icon-lucide-plus class="size-3.5" /></template>
          {{ t.homeNewDesign }}
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
          <Tip v-if="document.permission === 'view'" :label="t.homeViewOnlyTip">
            <icon-lucide-eye class="size-3" role="img" :aria-label="t.viewOnly" />
          </Tip>
          <Tip v-if="document.shared" :label="t.homeSharedTip">
            <icon-lucide-users class="size-3" role="img" :aria-label="t.homeShared" />
          </Tip>
          <CloudSyncIcon :state="document.sync" />
        </template>
      </DocumentEntry>
    </div>
  </section>
</template>
