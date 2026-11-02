<script setup lang="ts">
import { createColumnHelper } from '@tanstack/vue-table'
import { compact } from 'es-toolkit'
import { computed, h } from 'vue'

import type { CloudAdminUserFilter } from '@open-pencil/cloud/contract'
import { useCloudPortalMessages } from '@open-pencil/vue/i18n'

import {
  usePortalList,
  type PortalListPage,
  type PortalListRequest,
  type PortalTableFeatures
} from '@/app/cloud-portal/list'

import PortalIdentityCell from '../table/PortalIdentityCell.vue'
import PortalStatusCell from '../table/PortalStatusCell.vue'
import PortalTable from '../table/PortalTable.vue'
import type { PortalPerson, PortalPersonAction } from '../types'
import PortalPersonActions from './PortalPersonActions.vue'

/**
 * Everyone with an account on the server, a page at a time: filtered by what they are, searched
 * by name or email, each with what an administrator can do about them.
 */
const { load, busy = false } = defineProps<{
  load: (
    request: PortalListRequest<CloudAdminUserFilter>
  ) => Promise<PortalListPage<CloudAdminUserFilter, PortalPerson>>
  busy?: boolean
}>()
const emit = defineEmits<{
  act: [person: PortalPerson, action: PortalPersonAction, reason?: string]
  open: [personId: string]
}>()

const messages = useCloudPortalMessages()

/** What an account is on the server, as badges; an ordinary account has none. */
function standing(person: PortalPerson) {
  const words = messages.value
  return compact([
    person.admin && { label: words.administrator, tone: 'neutral' as const },
    person.suspended && { label: words.suspended, tone: 'error' as const },
    !person.suspended &&
      person.admin &&
      !person.twoStep && { label: words.twoStepOff, tone: 'warning' as const }
  ])
}

const column = createColumnHelper<PortalTableFeatures, PortalPerson>()
const people = usePortalList<CloudAdminUserFilter, PortalPerson>({
  filter: 'all',
  load: (request) => load(request),
  rowId: (person) => person.id,
  columns: column.columns([
    column.display({
      id: 'person',
      header: () => messages.value.columnPerson,
      cell: ({ row: { original: person } }) =>
        h(PortalIdentityCell, {
          id: person.id,
          name: person.name,
          detail: person.email,
          image: person.image,
          you: person.you,
          link: true,
          onOpen: () => emit('open', person.id)
        })
    }),
    column.display({
      id: 'role',
      header: () => messages.value.columnRole,
      meta: { class: 'hidden max-w-56 @md/table:table-cell' },
      // The badge says the account is suspended; the line under it says why.
      cell: ({ row: { original: person } }) =>
        h(PortalStatusCell, {
          statuses: standing(person),
          fallback: messages.value.member,
          detail: person.suspendedReason
        })
    }),
    column.accessor('workspaceCount', {
      header: () => messages.value.columnWorkspaces,
      meta: { class: 'hidden w-24 text-right tabular-nums @2xl/table:table-cell' }
    }),
    column.accessor((person) => person.lastActive ?? messages.value.notSignedIn, {
      id: 'lastActive',
      header: () => messages.value.columnLastActive,
      meta: { class: 'hidden w-32 whitespace-nowrap text-muted @xl/table:table-cell' }
    }),
    column.accessor('joinedOn', {
      header: () => messages.value.columnJoined,
      meta: { class: 'hidden w-28 whitespace-nowrap text-muted @3xl/table:table-cell' }
    }),
    column.display({
      id: 'actions',
      header: () => messages.value.columnActions,
      meta: { class: 'w-px text-right', actions: true },
      cell: ({ row: { original: person } }) =>
        h(PortalPersonActions, {
          person,
          disabled: busy,
          onAct: (action: PortalPersonAction, reason?: string) =>
            emit('act', person, action, reason)
        })
    })
  ])
})
const filters = computed(() => [
  { value: 'all' as const, label: messages.value.filterEveryone },
  { value: 'administrators' as const, label: messages.value.filterAdministrators },
  { value: 'suspended' as const, label: messages.value.filterSuspended },
  { value: 'without-two-step' as const, label: messages.value.filterWithoutTwoStep }
])

defineExpose({ reload: people.reload })
</script>

<template>
  <PortalTable
    :list="people"
    :label="messages.people"
    :search-label="messages.searchPeople"
    :filters="filters"
    :empty-label="messages.noPeopleFound"
    :empty-description="messages.noPeopleFoundDescription"
  >
    <template #icon><icon-lucide-users class="size-5" /></template>
  </PortalTable>
</template>
