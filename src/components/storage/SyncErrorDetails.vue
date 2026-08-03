<script setup lang="ts">
import { computed } from 'vue'
import { useClipboard } from '@vueuse/core'
import { useI18n } from '@open-pencil/vue'

import {
  buildCorsConfigurationJson,
  collectCloudCorsOrigins
} from '@/app/integrations/storage/s3/cors'
import type { SyncFailure } from '@/app/storage/sync'

const { failure } = defineProps<{ failure: SyncFailure }>()

const { dialogs } = useI18n()
const { copy: copyCors, copied: corsCopied } = useClipboard()

const operationLabel = computed(() => {
  const t = dialogs.value
  switch (failure.operation) {
    case 'putCanvas':
      return t.syncOperationPutCanvas
    case 'putMetadata':
      return t.syncOperationPutMetadata
    case 'putThumb':
      return t.syncOperationPutThumb
    default:
      return t.syncOperationDeleteCanvas
  }
})

/**
 * Guidance ACCOMPANIES the provider's words; it never replaces them.
 *
 * The raw error is rendered unconditionally below this. Substituting a friendly
 * sentence for `missing scopes (["buckets.read"])` would delete the only
 * actionable part of the message — the sentence explains the shape of the
 * problem, the provider names the fix.
 */
const guidance = computed(() => {
  const t = dialogs.value
  switch (failure.category) {
    case 'credentials':
      return t.syncGuidanceCredentials
    case 'permission':
      return t.syncGuidancePermission
    case 'not-found':
      return t.syncGuidanceNotFound
    case 'cors':
      return t.syncGuidanceCors
    case 'unreachable':
      return t.syncGuidanceUnreachable
    case 'offline':
      return t.syncGuidanceOffline
    case 'server':
      return t.syncGuidanceServer
    default:
      // `unknown` has no honest guidance to give. Saying something generic here
      // would push the provider's own text further down for no information.
      return null
  }
})

/**
 * Browser-offline is informational — the queue heals itself. CORS and a dead
 * endpoint look identical in the raw error but both need the user, so they get
 * the alarm styling and, for CORS, a configuration to paste.
 */
const informational = computed(() => failure.category === 'offline')
const showCorsConfiguration = computed(() => failure.category === 'cors')
const corsConfiguration = computed(() => buildCorsConfigurationJson(collectCloudCorsOrigins()))

const contextEntries = computed(() => Object.entries(failure.providerContext))
const documentLabel = computed(() => failure.documentName ?? failure.documentIds.join(', '))
</script>

<template>
  <dl class="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-[11px]">
    <dt class="text-muted">{{ dialogs.syncErrorOperation }}</dt>
    <dd class="text-surface">{{ operationLabel }}</dd>

    <dt class="text-muted">{{ dialogs.syncErrorDestination }}</dt>
    <dd class="min-w-0 text-surface">
      <p class="truncate">{{ failure.providerId }}</p>
      <p v-for="[field, value] in contextEntries" :key="field" class="truncate text-muted">
        {{ field }}: {{ value }}
      </p>
    </dd>

    <dt class="text-muted">{{ dialogs.syncErrorDocuments }}</dt>
    <dd class="min-w-0 truncate text-surface select-text">{{ documentLabel }}</dd>

    <dt class="text-muted">{{ dialogs.syncErrorTime }}</dt>
    <dd class="text-surface">{{ new Date(failure.occurredAt).toLocaleString() }}</dd>

    <dt class="text-muted">{{ dialogs.syncErrorAttempts }}</dt>
    <dd class="text-surface">{{ failure.attempts }}</dd>
  </dl>

  <section
    v-if="guidance"
    class="mt-3 rounded border border-border bg-panel-secondary px-2.5 py-2"
    :data-tone="informational ? 'info' : 'action'"
  >
    <h4 class="text-[10px] font-semibold text-surface">{{ dialogs.syncErrorLikelyCause }}</h4>
    <p class="mt-0.5 text-[11px] leading-relaxed text-muted select-text">{{ guidance }}</p>
  </section>

  <section class="mt-3">
    <h4 class="text-[10px] font-semibold text-surface">{{ dialogs.syncErrorRaw }}</h4>
    <pre
      class="mt-1 max-h-40 overflow-auto rounded border border-border bg-input px-2.5 py-2 font-mono text-[11px] whitespace-pre-wrap text-surface select-text"
      data-test-id="sync-error-raw"
      >{{ failure.rawError }}</pre
    >
  </section>

  <section v-if="showCorsConfiguration" class="mt-3">
    <div class="flex items-center justify-between gap-2">
      <h4 class="text-[10px] font-semibold text-surface">
        {{ dialogs.syncErrorCorsConfiguration }}
      </h4>
      <button
        type="button"
        class="flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium text-muted transition-colors hover:bg-hover hover:text-surface"
        data-test-id="sync-error-copy-cors"
        @click="copyCors(corsConfiguration)"
      >
        <icon-lucide-check v-if="corsCopied" class="size-3" />
        <icon-lucide-copy v-else class="size-3" />
        <span>{{ corsCopied ? dialogs.copied : dialogs.copyStorageCors }}</span>
      </button>
    </div>
    <pre
      class="mt-1 max-h-40 overflow-auto rounded border border-border bg-input px-2.5 py-2 font-mono text-[11px] text-surface select-text"
      >{{ corsConfiguration }}</pre
    >
  </section>
</template>
