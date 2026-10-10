<script setup lang="ts">
import { computed } from 'vue'

import { useCloudPortalMessages } from '@open-pencil/vue'

import AccountAvatar from '@/components/presence/AccountAvatar.vue'
import AppButton from '@/components/ui/button/AppButton.vue'
import AppPlaceholder from '@/components/ui/feedback/AppPlaceholder.vue'
import SegmentedControl from '@/components/ui/select/SegmentedControl.vue'
import { portalList } from '@/theme/cloud-portal/list'

import type { AccessRequest, AccessRequestStatus } from '../types'

/** People asking to join a server that reviews new accounts, and the decisions made so far. */
const { requests, busy = null } = defineProps<{
  requests: AccessRequest[]
  /** The request a decision is being saved for. */
  busy?: string | null
}>()
const filter = defineModel<AccessRequestStatus>('filter', { default: 'pending' })
const emit = defineEmits<{ approve: [id: string]; reject: [id: string]; revoke: [id: string] }>()

const ui = portalList()
const messages = useCloudPortalMessages()
const tones = {
  pending: 'warning',
  approved: 'success',
  rejected: 'neutral',
  revoked: 'error'
} as const
const labels = computed(() => ({
  pending: messages.value.statusWaiting,
  approved: messages.value.statusApproved,
  rejected: messages.value.statusDeclined,
  revoked: messages.value.statusRemoved
}))
function detail(request: AccessRequest) {
  const asked = messages.value.asked({ date: request.requestedOn })
  if (!request.reviewedBy || request.status === 'pending') return asked
  const decision = labels.value[request.status]
  return `${asked} · ${messages.value.reviewedBy({ decision, name: request.reviewedBy })}`
}
</script>

<template>
  <div class="flex flex-col gap-3">
    <div :class="ui.toolbar()">
      <SegmentedControl
        v-model="filter"
        required
        :label="messages.accessRequests"
        :options="[
          { value: 'pending', label: messages.filterWaiting },
          { value: 'approved', label: messages.filterApproved },
          { value: 'rejected', label: messages.filterDeclined },
          { value: 'revoked', label: messages.filterRemoved }
        ]"
      />
    </div>
    <ul v-if="requests.length" :class="ui.list()">
      <li v-for="request in requests" :key="request.id" :class="ui.row()">
        <AccountAvatar :id="request.email" :name="request.name ?? request.email" size="md" />
        <div :class="ui.body()">
          <p :class="ui.title()">
            {{ request.name ?? request.email }}
            <span v-if="request.name" class="font-normal text-muted">{{ request.email }}</span>
          </p>
          <p v-if="request.reason" :class="ui.quote()">“{{ request.reason }}”</p>
          <p :class="ui.detail()">{{ detail(request) }}</p>
        </div>
        <span
          v-if="request.status !== 'pending'"
          :class="ui.status()"
          :data-tone="tones[request.status]"
        >
          {{ labels[request.status] }}
        </span>
        <div :class="ui.actions()">
          <template v-if="request.status === 'pending'">
            <AppButton
              size="sm"
              variant="ghost"
              :disabled="busy === request.id"
              @click="emit('reject', request.id)"
            >
              {{ messages.decline }}
            </AppButton>
            <AppButton
              size="sm"
              color="primary"
              variant="solid"
              :loading="busy === request.id"
              @click="emit('approve', request.id)"
            >
              {{ messages.approve }}
            </AppButton>
          </template>
          <AppButton
            v-else-if="request.status === 'approved'"
            size="sm"
            variant="ghost"
            :loading="busy === request.id"
            @click="emit('revoke', request.id)"
          >
            {{ messages.removeAccess }}
          </AppButton>
        </div>
      </li>
    </ul>
    <AppPlaceholder
      v-else
      size="page"
      :label="filter === 'pending' ? messages.noOneWaiting : messages.nothingHere"
      :description="messages.requestsEmptyDescription"
      :ui="{ root: 'rounded-lg border border-dashed border-border' }"
    >
      <template #icon><icon-lucide-inbox class="size-5" /></template>
    </AppPlaceholder>
  </div>
</template>
