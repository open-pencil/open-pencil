<script setup lang="ts">
import { computed } from 'vue'

import type { WorkspaceEntitlements } from '@open-pencil/cloud/contract'

import { formatStorageBytes } from '@/app/storage/format-bytes'
import AppBadge from '@/components/ui/AppBadge.vue'
import AppProgress from '@/components/ui/AppProgress.vue'
import AppTextButton from '@/components/ui/AppTextButton.vue'

const { entitlements, loading, error } = defineProps<{
  entitlements: WorkspaceEntitlements | null
  loading: boolean
  error: string | null
}>()
const emit = defineEmits<{ retry: [] }>()

const usedBytes = computed(
  () =>
    (entitlements?.usage.committedStorageBytes ?? 0) +
    (entitlements?.usage.reservedStorageBytes ?? 0)
)
const storageSummary = computed(() => {
  if (!entitlements) return ''
  const used = formatStorageBytes(entitlements.usage.committedStorageBytes)
  const limit = entitlements.limits.maximumStorageBytes
  return limit === null ? `${used} used · Unlimited` : `${used} of ${formatStorageBytes(limit)}`
})
const features = computed(() =>
  entitlements
    ? ([
        ['Capability links', entitlements.features.capabilityLinks],
        ['Anonymous viewing', entitlements.features.anonymousView],
        ['Anonymous editing', entitlements.features.anonymousEdit],
        ['Guest presence', entitlements.features.guestPresence],
        ['Live collaboration', entitlements.features.collaboration],
        ['Revision history', entitlements.features.revisionHistory]
      ] as const)
    : []
)
</script>

<template>
  <section
    class="rounded border border-border bg-panel-field p-3"
    aria-labelledby="cloud-workspace-usage"
    aria-live="polite"
  >
    <div class="flex items-center justify-between gap-3">
      <h3 id="cloud-workspace-usage" class="text-[11px] font-medium text-surface">
        Workspace usage
      </h3>
      <span v-if="entitlements" class="text-[10px] tabular-nums text-muted">
        {{ storageSummary }}
      </span>
    </div>

    <p v-if="loading" class="mt-2 text-[10px] text-muted">Loading workspace usage…</p>
    <div v-else-if="error" class="mt-2 flex items-center justify-between gap-2">
      <p class="text-[10px] text-danger">
        Workspace limits could not be loaded. Reconnect to the Cloud server and try again.
      </p>
      <AppTextButton @click="emit('retry')">Retry</AppTextButton>
    </div>

    <template v-else-if="entitlements">
      <AppProgress
        v-if="entitlements.limits.maximumStorageBytes !== null"
        class="mt-2"
        :value="usedBytes"
        :max="entitlements.limits.maximumStorageBytes"
        label="Workspace storage used"
      />
      <p
        v-if="entitlements.usage.reservedStorageBytes > 0"
        class="mt-1 text-[9px] tabular-nums text-muted"
      >
        {{ formatStorageBytes(entitlements.usage.committedStorageBytes) }} stored ·
        {{ formatStorageBytes(entitlements.usage.reservedStorageBytes) }} uploading
      </p>

      <dl class="mt-3 space-y-1.5 border-t border-border pt-3">
        <div class="flex items-center justify-between gap-3 text-[10px]">
          <dt class="text-muted">Maximum file size</dt>
          <dd class="tabular-nums text-surface">
            {{ formatStorageBytes(entitlements.limits.maximumFileBytes) }}
          </dd>
        </div>
        <div class="flex items-center justify-between gap-3 text-[10px]">
          <dt class="text-muted">Storage allowance</dt>
          <dd class="tabular-nums text-surface">
            {{
              entitlements.limits.maximumStorageBytes === null
                ? 'Unlimited'
                : formatStorageBytes(entitlements.limits.maximumStorageBytes)
            }}
          </dd>
        </div>
      </dl>

      <div class="mt-3 space-y-1.5 border-t border-border pt-3">
        <div
          v-for="([label, available], index) in features"
          :key="label"
          class="flex items-center justify-between gap-3"
          :data-feature-index="index"
        >
          <span class="text-[10px] text-muted">{{ label }}</span>
          <AppBadge :ui="available ? undefined : { base: 'bg-hover text-muted' }">
            {{ available ? 'Available' : 'Unavailable' }}
          </AppBadge>
        </div>
      </div>
    </template>
  </section>
</template>
