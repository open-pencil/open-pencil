<script setup lang="ts">
import { createColumnHelper } from '@tanstack/vue-table'
import { computed, h, ref } from 'vue'
import IconPlug from '~icons/lucide/plug'

import { useMessages } from '@open-pencil/vue/i18n'

import { usePortalRows, type PortalTableFeatures } from '@/app/cloud-portal/list'
import SettingsSection from '@/components/settings/layout/SettingsSection.vue'
import AppButton from '@/components/ui/button/AppButton.vue'
import AppConfirmationDialog from '@/components/ui/dialog/AppConfirmationDialog.vue'
import AppPlaceholder from '@/components/ui/feedback/AppPlaceholder.vue'
import { useHeldContent } from '@/components/ui/overlay/held'
import AppDataTable from '@/components/ui/table/AppDataTable.vue'

import { portalColumnMeta } from '../table/columns'
import PortalTextCell from '../table/PortalTextCell.vue'
import type { PortalAppConnection } from '../types'

/**
 * The apps the person connected through OAuth: each by its name and the host it gave, the
 * workspace it reaches, what it may do there, and when it was connected, with disconnecting asked
 * once more.
 */
const {
  connections,
  busy = false,
  loading = false
} = defineProps<{
  connections: PortalAppConnection[]
  busy?: boolean
  /** `first` before anything has loaded, `refresh` while it loads again. */
  loading?: 'first' | 'refresh' | false
}>()
const emit = defineEmits<{ disconnect: [id: string] }>()

const messages = useMessages('cloud/portal')
const appMessages = useMessages('cloud/portal/apps')
const disconnecting = ref<PortalAppConnection | null>(null)
const disconnectingShown = useHeldContent(disconnecting)

const column = createColumnHelper<PortalTableFeatures, PortalAppConnection>()
const table = usePortalRows(() => connections, {
  rowId: (connection) => connection.id,
  columns: column.columns([
    column.display({
      id: 'name',
      header: () => messages.value.name,
      cell: ({ row: { original: connection } }) =>
        h(PortalTextCell, {
          icon: IconPlug,
          text: connection.name,
          strong: true,
          detail: connection.host
        })
    }),
    column.accessor('workspace', {
      header: () => appMessages.value.columnWorkspace,
      meta: { role: 'subject' }
    }),
    column.display({
      id: 'access',
      header: () => appMessages.value.columnAccess,
      meta: { role: 'tag' },
      cell: ({ row: { original: connection } }) =>
        connection.access === 'write' ? appMessages.value.accessWrite : appMessages.value.accessRead
    }),
    column.accessor('connected', {
      header: () => appMessages.value.columnConnected,
      meta: { role: 'date' }
    }),
    column.display({
      id: 'actions',
      header: () => messages.value.columnActions,
      meta: { role: 'actions' },
      cell: ({ row: { original: connection } }) =>
        h(
          AppButton,
          {
            size: 'sm',
            variant: 'ghost',
            disabled: busy,
            onClick: () => {
              disconnecting.value = connection
            }
          },
          () => appMessages.value.disconnect
        )
    })
  ])
})

const heading = computed(() =>
  disconnectingShown.value
    ? appMessages.value.disconnectHeading({ name: disconnectingShown.value.name })
    : ''
)

function confirm() {
  const connection = disconnecting.value
  disconnecting.value = null
  if (connection) emit('disconnect', connection.id)
}
</script>

<template>
  <div class="flex max-w-3xl flex-col gap-6">
    <SettingsSection>
      <template #title>{{ appMessages.connectedApps }}</template>
      <AppDataTable
        :table="table"
        :column-meta="portalColumnMeta"
        :label="appMessages.connectedApps"
        :loading="loading"
        :loading-label="messages.loading"
      >
        <template #empty>
          <AppPlaceholder :label="appMessages.noConnectedApps">
            <template #icon><icon-lucide-plug class="size-5" /></template>
          </AppPlaceholder>
        </template>
      </AppDataTable>
    </SettingsSection>

    <AppConfirmationDialog
      :open="disconnecting !== null"
      tone="danger"
      :heading="heading"
      :description="appMessages.disconnectDescription"
      :confirm-label="appMessages.disconnect"
      @update:open="(open) => !open && (disconnecting = null)"
      @confirm="confirm"
    />
  </div>
</template>
