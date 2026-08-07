<script setup lang="ts">
import { computed, ref } from 'vue'
import { tv } from 'tailwind-variants'
import { PopoverContent, PopoverPortal, PopoverRoot, PopoverTrigger } from 'reka-ui'
import { useI18n } from '@open-pencil/vue'

import { activeStorageProviderID, storageProviderRegistry } from '@/app/integrations/storage'
import { openSettingsDialog } from '@/app/settings/dialog'
import { useStorageConfigured } from '@/app/storage/configured'
import { lastSyncFailure, useSyncStatus } from '@/app/storage/sync'
import SyncErrorDialog from '@/components/storage/SyncErrorDialog.vue'
import { usePopoverUI } from '@/components/ui/popover'
import Tip from '@/components/ui/Tip.vue'
import syncStatusTheme from '@/theme/sync-status'

const { dialogs } = useI18n()
const configured = useStorageConfigured()
const provider = computed(() => storageProviderRegistry.get(activeStorageProviderID.value))

/**
 * Name the provider the failure was addressed to, not the one selected now.
 *
 * `lastSyncFailure.providerId` is captured at the moment of failure; the active
 * provider is a live setting. Reading the setting meant switching providers
 * re-labelled an existing failure with the new vendor's name — a document stuck
 * on Bunny reported itself as "Sync failed — Cloudflare R2".
 */
const failedProviderLabel = computed(() => {
  const providerId = lastSyncFailure.value?.providerId
  if (providerId && storageProviderRegistry.has(providerId)) {
    return storageProviderRegistry.get(providerId).label
  }
  return provider.value.label
})

const { indicator, label, failure, spinnerVisible, actionable, canConnect } = useSyncStatus({
  configured: () => configured.value,
  providerLabel: () => failedProviderLabel.value
})

const detailOpen = ref(false)
const cls = computed(() =>
  tv(syncStatusTheme)({
    indicator: indicator.value,
    actionable: actionable.value || canConnect.value
  })
)
const popover = usePopoverUI({ content: 'w-80 border border-border p-3' })

/**
 * Where "your only copy is in this browser" is explained.
 *
 * Saying nothing would be dishonest — browser storage really can vanish. But
 * the workspace used to say it twice: a full-width banner above the document
 * grid and this chip below it, both reporting the same unconfigured cloud. The
 * banner charged prime vertical space on every visit to repeat what the empty
 * state had already explained, and its accent CTA read as an upsell for a mode
 * the user may have chosen deliberately.
 *
 * One surface owns storage state now. The chip carries the short form
 * permanently; the durable-copy caveat lives one click away, where a full
 * sentence can be read without truncating into a 20px footer.
 */
const durabilityOpen = ref(false)

/**
 * The popover is the only thing `open` may describe.
 *
 * `PopoverTrigger` toggles the root for every state of the chip, so a failing
 * sync would otherwise mark the trigger expanded against content that is not
 * rendered. Gate the write instead of the trigger: the button keeps one
 * implementation across all six indicators.
 */
function setDurabilityOpen(value: boolean): void {
  durabilityOpen.value = canConnect.value && value
}

/**
 * Same control, two destinations: a failure to read, or a cloud to set up.
 *
 * The hint matters more now that no banner advertises the unconfigured state:
 * a 10px chip in a 20px footer has to say out loud that it can be clicked, or
 * the durability caveat behind it is discoverable only by accident.
 */
const hint = computed(() => {
  if (canConnect.value) return dialogs.value.syncStatusSetUpCloud
  return actionable.value ? dialogs.value.syncStatusShowDetails : undefined
})

function activate(): void {
  if (actionable.value) detailOpen.value = true
}

function connectCloud(): void {
  durabilityOpen.value = false
  openSettingsDialog('storage')
}
</script>

<template>
  <PopoverRoot :open="durabilityOpen" @update:open="setDurabilityOpen">
    <Tip :label="hint">
      <PopoverTrigger as-child>
        <button
          type="button"
          :class="cls.chip()"
          :disabled="!actionable && !canConnect"
          :aria-label="hint"
          data-test-id="cloud-workspace-status"
          :data-indicator="indicator"
          @click="activate"
        >
          <span :class="cls.indicator()" aria-hidden="true">
            <icon-lucide-cloud-upload v-if="spinnerVisible" :class="cls.icon()" />
            <icon-lucide-cloud-off v-else-if="indicator === 'local'" :class="cls.icon()" />
            <icon-lucide-cloud-alert
              v-else-if="indicator === 'degraded' || indicator === 'failing'"
              :class="cls.icon()"
            />
            <icon-lucide-cloud-check v-else :class="cls.icon()" />
          </span>
          <span :class="cls.label()">{{ label }}</span>
        </button>
      </PopoverTrigger>
    </Tip>
    <PopoverPortal>
      <PopoverContent
        v-if="canConnect"
        side="top"
        align="center"
        :side-offset="8"
        :collision-padding="8"
        :class="popover.content"
        data-test-id="local-durability-notice"
        data-placement="status"
      >
        <div class="flex items-start gap-3">
          <icon-lucide-hard-drive class="mt-0.5 size-4 shrink-0 text-muted" aria-hidden="true" />
          <div class="min-w-0 flex-1">
            <p class="text-xs font-medium text-surface">{{ dialogs.localDurabilityTitle }}</p>
            <p class="mt-1 text-[11px] leading-snug text-muted">
              {{ dialogs.localDurabilityBody }}
            </p>
            <button
              type="button"
              class="mt-2.5 rounded bg-accent px-2.5 py-1 text-[11px] font-medium text-white hover:bg-accent/90"
              @click="connectCloud"
            >
              {{ dialogs.settingsStorage }}
            </button>
          </div>
        </div>
      </PopoverContent>
    </PopoverPortal>
  </PopoverRoot>

  <SyncErrorDialog v-model:open="detailOpen" :failure="failure" />
</template>
