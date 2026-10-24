<script setup lang="ts">
import { computed } from 'vue'

import type { CloudAdminUserFilter } from '@open-pencil/cloud/contract'
import { useCloudPortalMessages } from '@open-pencil/vue/i18n'

import AccountAvatar from '@/components/presence/AccountAvatar.vue'
import IconButton from '@/components/ui/button/IconButton.vue'
import AppPlaceholder from '@/components/ui/feedback/AppPlaceholder.vue'
import AppInput from '@/components/ui/input/AppInput.vue'
import SegmentedControl from '@/components/ui/select/SegmentedControl.vue'
import { portalList } from '@/theme/cloud-portal/list'

import type { PortalPerson, PortalPersonAction } from '../types'
import PortalPersonActions from './PortalPersonActions.vue'

/**
 * Everyone with an account on the server, a page at a time: filtered by what they are, searched
 * by name or email, each with what an administrator can do about them.
 */
const {
  people,
  counts,
  offset = 0,
  pageSize = 50,
  busy = false
} = defineProps<{
  people: PortalPerson[]
  /** How many accounts match the search under each filter. */
  counts: Record<CloudAdminUserFilter, number>
  offset?: number
  pageSize?: number
  busy?: boolean
}>()
const query = defineModel<string>('query', { default: '' })
const filter = defineModel<CloudAdminUserFilter>('filter', { default: 'all' })
const emit = defineEmits<{
  act: [person: PortalPerson, action: PortalPersonAction, reason?: string]
  open: [personId: string]
  page: [offset: number]
}>()

const ui = portalList()
const messages = useCloudPortalMessages()
const total = computed(() => counts[filter.value])
const filters = computed(() => [
  { value: 'all', label: messages.value.filterEveryone },
  { value: 'administrators', label: messages.value.filterAdministrators },
  { value: 'suspended', label: messages.value.filterSuspended },
  { value: 'without-two-step', label: messages.value.filterWithoutTwoStep }
])
const isFilter = (value: string): value is CloudAdminUserFilter =>
  filters.value.some((option) => option.value === value)
const filterValue = computed({
  get: () => filter.value,
  set: (value: string) => {
    if (isFilter(value)) filter.value = value
  }
})
const range = computed(() =>
  messages.value.pageRange({
    from: Math.min(offset + 1, total.value),
    to: Math.min(offset + people.length, total.value),
    total: total.value
  })
)
</script>

<template>
  <div class="flex flex-col gap-3">
    <div :class="ui.toolbar()">
      <AppInput
        v-model="query"
        type="search"
        density="compact"
        :placeholder="messages.searchPeople"
        :aria-label="messages.searchPeople"
        class="w-64"
      >
        <template #leading><icon-lucide-search class="size-3.5" /></template>
      </AppInput>
      <SegmentedControl v-model="filterValue" required :label="messages.people" :options="filters">
        <template #option="{ option }">
          {{ option.label }}
          <span class="text-muted tabular-nums">
            {{ isFilter(option.value) ? counts[option.value] : '' }}
          </span>
        </template>
      </SegmentedControl>
    </div>
    <ul v-if="people.length" :class="ui.list()">
      <li v-for="person in people" :key="person.id" :class="ui.row()">
        <AccountAvatar :id="person.id" :name="person.name" :image="person.image" size="md" />
        <button
          type="button"
          :class="[
            ui.body(),
            'rounded text-left focus-visible:ring-2 focus-visible:ring-accent/50 focus-visible:outline-none'
          ]"
          @click="emit('open', person.id)"
        >
          <span :class="ui.title()">
            {{ person.name }}
            <span v-if="person.you" class="font-normal text-muted">{{ messages.you }}</span>
          </span>
          <span :class="[ui.detail(), 'block']">
            {{ person.email }}
            <template v-if="person.suspendedReason">
              · {{ messages.suspendedReason({ reason: person.suspendedReason }) }}
            </template>
          </span>
        </button>
        <span v-if="person.admin" :class="ui.status()" data-tone="neutral">
          {{ messages.administrator }}
        </span>
        <span v-if="person.suspended" :class="ui.status()" data-tone="error">
          {{ messages.suspended }}
        </span>
        <span v-else-if="person.admin && !person.twoStep" :class="ui.status()" data-tone="warning">
          {{ messages.twoStepOff }}
        </span>
        <span :class="[ui.meta(), 'w-24 text-right']">
          {{ messages.workspaceCount(person.workspaceCount) }}
        </span>
        <span :class="[ui.meta(), 'w-28 text-right']">
          {{
            person.lastActive
              ? messages.lastActive({ when: person.lastActive })
              : messages.notSignedIn
          }}
        </span>
        <span :class="[ui.meta(), 'w-32 text-right']">
          {{ messages.joined({ date: person.joinedOn }) }}
        </span>
        <PortalPersonActions
          :person="person"
          :disabled="busy"
          @act="(action, reason) => emit('act', person, action, reason)"
        />
      </li>
    </ul>
    <AppPlaceholder
      v-else
      size="compact"
      :fill="false"
      :label="messages.noPeopleFound"
      :description="messages.noPeopleFoundDescription"
    >
      <template #icon><icon-lucide-users class="size-5" /></template>
    </AppPlaceholder>
    <div v-if="total > pageSize" class="flex items-center justify-end gap-1 text-[11px] text-muted">
      <span class="tabular-nums">{{ range }}</span>
      <IconButton
        :label="messages.previousPage"
        :disabled="offset === 0"
        @click="emit('page', Math.max(0, offset - pageSize))"
      >
        <icon-lucide-chevron-left class="size-3.5" />
      </IconButton>
      <IconButton
        :label="messages.nextPage"
        :disabled="offset + people.length >= total"
        @click="emit('page', offset + pageSize)"
      >
        <icon-lucide-chevron-right class="size-3.5" />
      </IconButton>
    </div>
  </div>
</template>
