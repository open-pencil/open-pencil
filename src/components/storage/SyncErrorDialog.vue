<script setup lang="ts">
import { useClipboard } from '@vueuse/core'
import { useI18n } from '@open-pencil/vue'

import { openSettingsDialog } from '@/app/settings/dialog'
import { formatSyncFailureReport, resumeStorageSync, type SyncFailure } from '@/app/storage/sync'
import SyncErrorDetails from '@/components/storage/SyncErrorDetails.vue'
import {
  AppDialogBody,
  AppDialogFooter,
  AppDialogHeader,
  AppDialogRoot
} from '@/components/ui/dialog'

const { failure } = defineProps<{ failure: SyncFailure | null }>()

const open = defineModel<boolean>('open', { default: false })
const { dialogs } = useI18n()
const { copy, copied } = useClipboard()

function copyDetails(): void {
  if (failure) void copy(formatSyncFailureReport(failure))
}

async function retryNow(): Promise<void> {
  open.value = false
  await resumeStorageSync()
}

function openStorageSettings(): void {
  open.value = false
  openSettingsDialog('storage')
}
</script>

<template>
  <AppDialogRoot v-model:open="open" size="md" data-test-id="sync-error-dialog">
    <AppDialogHeader
      :heading="dialogs.syncErrorTitle"
      :description="dialogs.syncErrorDescription"
      :close-label="dialogs.close"
    />
    <AppDialogBody>
      <SyncErrorDetails v-if="failure" :failure="failure" />
      <!--
        The chip can be actionable without a captured failure: a queue parked
        while the browser is offline never reached a provider, so there is no
        provider error to show. Saying so beats an empty dialog.
      -->
      <p v-else class="text-[11px] text-muted">{{ dialogs.syncErrorNoDetail }}</p>
    </AppDialogBody>
    <AppDialogFooter>
      <button
        type="button"
        class="mr-auto flex items-center gap-1 rounded px-2 py-1.5 text-xs text-muted hover:bg-hover hover:text-surface disabled:opacity-50"
        data-test-id="sync-error-copy-details"
        :disabled="!failure"
        @click="copyDetails"
      >
        <icon-lucide-check v-if="copied" class="size-3" />
        <icon-lucide-copy v-else class="size-3" />
        {{ copied ? dialogs.copied : dialogs.syncCopyDetails }}
      </button>
      <button
        type="button"
        class="rounded px-3 py-1.5 text-xs text-muted hover:bg-hover hover:text-surface"
        data-test-id="sync-error-open-settings"
        @click="openStorageSettings"
      >
        {{ dialogs.syncOpenStorageSettings }}
      </button>
      <button
        type="button"
        class="rounded bg-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-accent/90"
        data-test-id="sync-error-retry"
        @click="retryNow"
      >
        {{ dialogs.syncRetryNow }}
      </button>
    </AppDialogFooter>
  </AppDialogRoot>
</template>
