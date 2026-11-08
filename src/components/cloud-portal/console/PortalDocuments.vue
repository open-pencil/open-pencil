<script setup lang="ts">
import { createColumnHelper } from '@tanstack/vue-table'
import { computed, h, ref } from 'vue'

import type { CloudAdminDocumentFilter } from '@open-pencil/cloud/contract'
import { useCloudPortalMessages } from '@open-pencil/vue/i18n'

import {
  usePortalList,
  type PortalListPage,
  type PortalListRequest,
  type PortalTableFeatures
} from '@/app/cloud-portal/list'

import PortalIdentityCell from '../table/PortalIdentityCell.vue'
import PortalRowMenu from '../table/PortalRowMenu.vue'
import PortalStatusCell from '../table/PortalStatusCell.vue'
import PortalTable from '../table/PortalTable.vue'
import PortalTextCell from '../table/PortalTextCell.vue'
import type { PortalContentAction, PortalDocumentRow } from '../types'
import { contentActions } from './content'
import PortalContentConfirm from './PortalContentConfirm.vue'

/** Every document on the server, to find one by name, ID, or owner and take it down or back. */
const { load, busy = null } = defineProps<{
  load: (
    request: PortalListRequest<CloudAdminDocumentFilter>
  ) => Promise<PortalListPage<CloudAdminDocumentFilter, PortalDocumentRow>>
  /** The document an action is being saved for. */
  busy?: string | null
}>()
const emit = defineEmits<{
  act: [action: PortalContentAction, document: PortalDocumentRow, reason?: string]
}>()

const messages = useCloudPortalMessages()
const pending = ref<{ action: PortalContentAction; document: PortalDocumentRow } | null>(null)
function confirm(reason?: string) {
  const chosen = pending.value
  pending.value = null
  if (chosen) emit('act', chosen.action, chosen.document, reason)
}

const column = createColumnHelper<PortalTableFeatures, PortalDocumentRow>()
const documents = usePortalList<CloudAdminDocumentFilter, PortalDocumentRow>({
  filter: 'all',
  load: (request) => load(request),
  rowId: (document) => document.id,
  columns: column.columns([
    column.display({
      id: 'document',
      header: () => messages.value.columnDocument,
      cell: ({ row: { original: document } }) =>
        h(PortalTextCell, { text: document.name, strong: true, detail: document.workspace })
    }),
    column.display({
      id: 'owner',
      header: () => messages.value.columnOwner,
      meta: { class: 'hidden w-1/4 @xl/table:table-cell' },
      cell: ({ row: { original: document } }) =>
        document.owner
          ? h(PortalIdentityCell, {
              id: document.owner.id,
              name: document.owner.name,
              detail: document.owner.email,
              size: 'sm'
            })
          : h(PortalTextCell, { text: messages.value.someoneElse })
    }),
    column.accessor('updated', {
      header: () => messages.value.columnUpdated,
      meta: { class: 'hidden w-32 whitespace-nowrap text-muted @2xl/table:table-cell' }
    }),
    column.display({
      id: 'status',
      header: () => messages.value.columnStatus,
      meta: { class: 'w-40' },
      cell: ({ row: { original: document } }) =>
        h(PortalStatusCell, {
          statuses: [
            ...(document.takenDown
              ? [{ label: messages.value.takenDown, tone: 'error' as const }]
              : []),
            ...(document.openReports
              ? [
                  {
                    label: messages.value.openReports(document.openReports),
                    tone: 'warning' as const
                  }
                ]
              : [])
          ],
          detail: document.takenDownReason
        })
    }),
    column.display({
      id: 'actions',
      header: () => messages.value.columnActions,
      meta: { class: 'w-px whitespace-nowrap text-right', actions: true },
      cell: ({ row: { original: document } }) =>
        h(PortalRowMenu<PortalContentAction>, {
          label: messages.value.actionsFor({ name: document.name }),
          items: contentActions(messages.value, document),
          disabled: busy === document.id,
          onSelect: (action: PortalContentAction) => (pending.value = { action, document })
        })
    })
  ])
})
const filters = computed(() => [
  { value: 'all' as const, label: messages.value.filterAll },
  { value: 'reported' as const, label: messages.value.filterReported },
  { value: 'disabled' as const, label: messages.value.filterTakenDown }
])

defineExpose({ reload: documents.reload })
</script>

<template>
  <PortalTable
    :list="documents"
    :label="messages.documents"
    :search-label="messages.searchDocuments"
    :filters="filters"
    :empty-label="messages.noDocumentsFound"
    :empty-description="messages.noDocumentsFoundDescription"
  >
    <template #icon><icon-lucide-file-text class="size-5" /></template>
  </PortalTable>
  <PortalContentConfirm :pending="pending" @confirm="confirm" @cancel="pending = null" />
</template>
