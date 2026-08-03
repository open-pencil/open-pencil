<script setup lang="ts">
import { useLocalStorage } from '@vueuse/core'
import { computed } from 'vue'
import { useI18n } from '@open-pencil/vue'

import { openSettingsDialog } from '@/app/settings/dialog'
import { useStorageConfigured } from '@/app/storage/configured'

const { dialogs } = useI18n()
const configured = useStorageConfigured()

/**
 * Shown once, to someone whose only copy is in this browser.
 *
 * Saying nothing would be dishonest — browser storage really can vanish. But a
 * standing banner would contradict the whole position: local-only is a
 * supported way to work, and a permanent warning about a supported
 * configuration is just nagging. So it appears once, it is dismissible, and it
 * never returns.
 *
 * Suppressed entirely when cloud is configured, since the durable copy the
 * notice would advise already exists.
 */
const dismissed = useLocalStorage('open-pencil:local-durability-dismissed', false)
const visible = computed(() => !dismissed.value && !configured.value)

function connectCloud(): void {
  dismissed.value = true
  openSettingsDialog('storage')
}
</script>

<template>
  <aside
    v-if="visible"
    class="flex items-start gap-3 border-b border-border bg-panel px-4 py-2.5"
    data-test-id="local-durability-notice"
  >
    <icon-lucide-hard-drive class="mt-0.5 size-4 shrink-0 text-muted" aria-hidden="true" />
    <div class="min-w-0 flex-1">
      <p class="text-xs font-medium text-surface">{{ dialogs.localDurabilityTitle }}</p>
      <p class="mt-0.5 text-[11px] leading-snug text-muted">{{ dialogs.localDurabilityBody }}</p>
    </div>
    <div class="flex shrink-0 items-center gap-2">
      <button
        type="button"
        class="rounded bg-accent px-2.5 py-1 text-[11px] font-medium text-white hover:bg-accent/90"
        @click="connectCloud"
      >
        {{ dialogs.settingsStorage }}
      </button>
      <button
        type="button"
        class="rounded border border-border px-2.5 py-1 text-[11px] font-medium text-surface hover:bg-hover"
        data-test-id="local-durability-dismiss"
        @click="dismissed = true"
      >
        {{ dialogs.localDurabilityDismiss }}
      </button>
    </div>
  </aside>
</template>
