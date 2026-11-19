<script setup lang="ts">
import { createColumnHelper } from '@tanstack/vue-table'
import { compact } from 'es-toolkit'
import { computed, h, ref } from 'vue'

import {
  CLOUD_SOCIAL_PROVIDER_NAMES,
  CLOUD_SOCIAL_PROVIDERS,
  type CloudAdminUserFilter,
  type CloudAdminUserMethod
} from '@open-pencil/cloud/contract'
import { useCloudPortalMessages } from '@open-pencil/vue/i18n'

import {
  usePortalList,
  type PortalListPage,
  type PortalListRequest,
  type PortalTableFeatures
} from '@/app/cloud-portal/list'
import AppSelect from '@/components/ui/select/AppSelect.vue'

import PortalIdentityCell from '../table/PortalIdentityCell.vue'
import PortalSignInMethodsCell from '../table/PortalSignInMethodsCell.vue'
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
    request: PortalListRequest<CloudAdminUserFilter>,
    method?: CloudAdminUserMethod
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
  const access = {
    waiting: { label: words.statusWaiting, tone: 'warning' as const },
    declined: { label: words.statusDeclined, tone: 'neutral' as const },
    removed: { label: words.statusRemoved, tone: 'neutral' as const }
  }
  return compact([
    // An account exists from its first sign-in, before anyone approved its request.
    person.access && access[person.access],
    person.admin && { label: words.administrator, tone: 'neutral' as const },
    person.suspended && { label: words.suspended, tone: 'error' as const },
    !person.suspended &&
      person.admin &&
      !person.twoStep && { label: words.twoStepOff, tone: 'warning' as const }
  ])
}

/** Narrows any filter to people who sign in one way; `any` leaves it as it is. */
const method = ref<CloudAdminUserMethod | 'any'>('any')

const column = createColumnHelper<PortalTableFeatures, PortalPerson>()
const people = usePortalList<CloudAdminUserFilter, PortalPerson>({
  filter: 'all',
  load: (request) => load(request, method.value === 'any' ? undefined : method.value),
  scope: method,
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
      meta: { role: 'tag' },
      // The badge says the account is suspended; the line under it says why.
      cell: ({ row: { original: person } }) =>
        h(PortalStatusCell, {
          statuses: standing(person),
          fallback: messages.value.member,
          detail: person.suspendedReason
        })
    }),
    column.display({
      id: 'methods',
      header: () => messages.value.columnSignIn,
      meta: { role: 'tag' },
      cell: ({ row: { original: person } }) =>
        h(PortalSignInMethodsCell, { methods: person.methods })
    }),
    column.accessor('workspaceCount', {
      header: () => messages.value.columnWorkspaces,
      meta: { role: 'count' }
    }),
    column.accessor((person) => person.lastActive ?? messages.value.notSignedIn, {
      id: 'lastActive',
      header: () => messages.value.columnLastActive,
      meta: { role: 'date' }
    }),
    column.accessor('joinedOn', {
      header: () => messages.value.columnJoined,
      meta: { role: 'date' }
    }),
    column.display({
      id: 'actions',
      header: () => messages.value.columnActions,
      meta: { role: 'actions' },
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
const methods = computed(() => [
  { value: 'any' as const, label: messages.value.signInAny },
  { value: 'password' as const, label: messages.value.password },
  ...CLOUD_SOCIAL_PROVIDERS.map((provider) => ({
    value: provider,
    label: CLOUD_SOCIAL_PROVIDER_NAMES[provider]
  }))
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
    <template #toolbar>
      <AppSelect
        v-model="method"
        :label="messages.columnSignIn"
        :options="methods"
        size="md"
        :ui="{ trigger: 'w-36' }"
      />
    </template>
  </PortalTable>
</template>
