<script setup lang="ts">
import { createColumnHelper } from '@tanstack/vue-table'
import { computed, h, ref } from 'vue'

import { useCloudPortalMessages } from '@open-pencil/vue/i18n'

import {
  usePortalList,
  type PortalListPage,
  type PortalListRequest,
  type PortalTableFeatures
} from '@/app/cloud-portal/list'
import { portalForm } from '@/components/cloud-portal/ui'
import AppConfirmationDialog from '@/components/ui/dialog/AppConfirmationDialog.vue'
import AppTextarea from '@/components/ui/input/AppTextarea.vue'
import { useHeldContent } from '@/components/ui/overlay/held'

import PortalIdentityCell from '../table/PortalIdentityCell.vue'
import PortalRequestActions from '../table/PortalRequestActions.vue'
import PortalTable from '../table/PortalTable.vue'
import PortalTextCell from '../table/PortalTextCell.vue'
import type { AccessRequest, AccessRequestStatus } from '../types'

/** People asking to join a server that reviews new accounts, and the decisions made so far. */
const { load, busy = null } = defineProps<{
  load: (
    request: PortalListRequest<AccessRequestStatus>
  ) => Promise<PortalListPage<AccessRequestStatus, AccessRequest>>
  /** The request a decision is being saved for. */
  busy?: string | null
}>()
const emit = defineEmits<{
  approve: [id: string]
  reject: [id: string, note?: string]
  revoke: [id: string, note?: string]
}>()

const form = portalForm()
const messages = useCloudPortalMessages()
const name = (request: AccessRequest) => request.name ?? request.email
const labels = computed(() => ({
  pending: messages.value.statusWaiting,
  approved: messages.value.statusApproved,
  rejected: messages.value.statusDeclined,
  revoked: messages.value.statusRemoved
}))

const column = createColumnHelper<PortalTableFeatures, AccessRequest>()
const requests = usePortalList<AccessRequestStatus, AccessRequest>({
  filter: 'pending',
  load: (request) => load(request),
  rowId: (request) => request.id,
  columns: column.columns([
    column.display({
      id: 'person',
      header: () => messages.value.columnPerson,
      cell: ({ row: { original: request } }) =>
        h(PortalIdentityCell, {
          id: request.email,
          name: name(request),
          detail: request.name ? request.email : null
        })
    }),
    column.display({
      id: 'reason',
      header: () => messages.value.columnReason,
      meta: { class: 'hidden w-2/5 @2xl/table:table-cell' },
      cell: ({ row: { original: request } }) => h(PortalTextCell, { quote: request.reason })
    }),
    column.accessor('requestedOn', {
      header: () => messages.value.columnRequested,
      meta: { class: 'hidden w-28 whitespace-nowrap text-muted @xl/table:table-cell' }
    }),
    column.display({
      id: 'decision',
      header: () => messages.value.columnDecision,
      meta: { class: 'hidden @3xl/table:table-cell' },
      cell: ({ row: { original: request } }) =>
        h(PortalTextCell, {
          text: request.reviewedBy
            ? messages.value.reviewedBy({
                decision: labels.value[request.status],
                name: request.reviewedBy
              })
            : null,
          detail: request.note ? messages.value.noteDetail({ note: request.note }) : null
        })
    }),
    column.display({
      id: 'actions',
      header: () => messages.value.columnActions,
      meta: { class: 'w-px whitespace-nowrap text-right', actions: true },
      cell: ({ row: { original: request } }) =>
        h(PortalRequestActions, {
          request,
          busy: busy === request.id,
          onApprove: () => emit('approve', request.id),
          onAsk: (kind: 'reject' | 'revoke') => ask(kind, request)
        })
    })
  ])
})
const filters = computed(() => [
  { value: 'pending' as const, label: messages.value.filterWaiting },
  { value: 'approved' as const, label: messages.value.filterApproved },
  { value: 'rejected' as const, label: messages.value.filterDeclined },
  { value: 'revoked' as const, label: messages.value.filterRemoved }
])
// Waiting requests have no decision yet.
const hidden = computed(() => (requests.filter.value === 'pending' ? ['decision'] : []))
/** Declining or taking access away is asked once more, with a note for the other administrators. */
const confirming = ref<{ kind: 'reject' | 'revoke'; request: AccessRequest } | null>(null)
const note = ref('')
const confirmingShown = useHeldContent(confirming)
const confirmation = computed(() => {
  const pending = confirmingShown.value
  if (!pending) return null
  const words = messages.value
  return pending.kind === 'reject'
    ? {
        heading: words.declineHeading({ name: name(pending.request) }),
        description: words.declineDescription,
        confirm: words.decline
      }
    : {
        heading: words.removeAccessHeading({ name: name(pending.request) }),
        description: words.removeAccessDescription,
        confirm: words.removeAccess
      }
})
function ask(kind: 'reject' | 'revoke', request: AccessRequest) {
  note.value = ''
  confirming.value = { kind, request }
}
function confirm() {
  const pending = confirming.value
  confirming.value = null
  if (!pending) return
  const written = note.value.trim() || undefined
  if (pending.kind === 'reject') emit('reject', pending.request.id, written)
  else emit('revoke', pending.request.id, written)
}

defineExpose({ reload: requests.reload })
</script>

<template>
  <PortalTable
    :list="requests"
    :label="messages.accessRequests"
    :search-label="messages.searchRequests"
    :filters="filters"
    :hidden="hidden"
    :empty-label="
      requests.filter.value === 'pending' ? messages.noOneWaiting : messages.nothingHere
    "
    :empty-description="messages.requestsEmptyDescription"
  >
    <template #icon><icon-lucide-inbox class="size-5" /></template>
  </PortalTable>
  <AppConfirmationDialog
    :open="confirming !== null"
    tone="danger"
    :heading="confirmation?.heading ?? ''"
    :description="confirmation?.description"
    :cancel-label="messages.cancel"
    :confirm-label="confirmation?.confirm ?? ''"
    @update:open="(open) => !open && (confirming = null)"
    @confirm="confirm"
  >
    <div :class="[form.field(), 'mt-3']">
      <label for="portal-review-note" :class="form.label()">{{ messages.reviewNote }}</label>
      <AppTextarea id="portal-review-note" v-model="note" :rows="2" maxlength="1000" />
    </div>
  </AppConfirmationDialog>
</template>
