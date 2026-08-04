<script setup lang="ts">
import { useI18n } from '@open-pencil/vue'

import { openSettingsDialog } from '@/app/settings/dialog'

const { dialogs } = useI18n()

/**
 * Shown to someone whose only copy is in this browser.
 *
 * Saying nothing would be dishonest — browser storage really can vanish. But a
 * warning that disappears after “Got it” makes the workspace less informative
 * without changing where anything is stored. Keep the context present until a
 * durable cloud destination is actually configured.
 *
 * Visibility belongs to the workspace, which knows whether it has documents
 * and whether cloud is configured. This component owns only the populated-state
 * banner; the empty workspace integrates the same context into its placeholder.
 */
function connectCloud(): void {
  openSettingsDialog('storage')
}
</script>

<template>
  <aside
    class="flex items-start gap-3 border-b border-border bg-panel px-4 py-2.5"
    data-test-id="local-durability-notice"
  >
    <icon-lucide-hard-drive class="mt-0.5 size-4 shrink-0 text-muted" aria-hidden="true" />
    <div class="min-w-0 flex-1">
      <p class="text-xs font-medium text-surface">{{ dialogs.localDurabilityTitle }}</p>
      <p class="mt-0.5 text-[11px] leading-snug text-muted">{{ dialogs.localDurabilityBody }}</p>
    </div>
    <div class="shrink-0">
      <button
        type="button"
        class="rounded bg-accent px-2.5 py-1 text-[11px] font-medium text-white hover:bg-accent/90"
        @click="connectCloud"
      >
        {{ dialogs.settingsStorage }}
      </button>
    </div>
  </aside>
</template>
