<script setup lang="ts">
import AccountAvatar from '@/components/presence/AccountAvatar.vue'
import AppButton from '@/components/ui/button/AppButton.vue'
import AppPlaceholder from '@/components/ui/feedback/AppPlaceholder.vue'
import SegmentedControl from '@/components/ui/select/SegmentedControl.vue'
import { portalList } from '@/theme/cloud-portal/list'

import type { AccessRequestStatus, AccessRequest } from '../types'

/** People asking to join a server that reviews new accounts, and the decisions made so far. */
const { requests } = defineProps<{ requests: AccessRequest[] }>()
const filter = defineModel<AccessRequestStatus>('filter', { default: 'pending' })
const emit = defineEmits<{ approve: [id: string]; reject: [id: string]; revoke: [id: string] }>()

const ui = portalList()
const tones = {
  pending: 'warning',
  approved: 'success',
  rejected: 'neutral',
  revoked: 'error'
} as const
const labels = {
  pending: 'Waiting',
  approved: 'Approved',
  rejected: 'Declined',
  revoked: 'Access removed'
}
</script>

<template>
  <div class="flex flex-col gap-3">
    <div :class="ui.toolbar()">
      <SegmentedControl
        v-model="filter"
        required
        label="Show"
        :options="[
          { value: 'pending', label: 'Waiting' },
          { value: 'approved', label: 'Approved' },
          { value: 'rejected', label: 'Declined' },
          { value: 'revoked', label: 'Removed' }
        ]"
      />
    </div>
    <ul v-if="requests.length" :class="ui.list()">
      <li v-for="request in requests" :key="request.id" :class="ui.row()">
        <AccountAvatar :id="request.email" :name="request.name" size="md" />
        <div :class="ui.body()">
          <p :class="ui.title()">
            {{ request.name }}
            <span class="font-normal text-muted">{{ request.email }}</span>
          </p>
          <p v-if="request.reason" :class="ui.quote()">“{{ request.reason }}”</p>
          <p :class="ui.detail()">
            Asked {{ request.requestedAgo
            }}{{
              request.reviewedBy ? ` · ${labels[request.status]} by ${request.reviewedBy}` : ''
            }}
          </p>
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
            <AppButton size="sm" variant="ghost" @click="emit('reject', request.id)"
              >Decline</AppButton
            >
            <AppButton
              size="sm"
              color="primary"
              variant="solid"
              @click="emit('approve', request.id)"
            >
              Approve
            </AppButton>
          </template>
          <AppButton
            v-else-if="request.status === 'approved'"
            size="sm"
            variant="ghost"
            @click="emit('revoke', request.id)"
          >
            Remove access
          </AppButton>
        </div>
      </li>
    </ul>
    <AppPlaceholder
      v-else
      size="page"
      :label="filter === 'pending' ? 'No one is waiting' : 'Nothing here yet'"
      description="New requests appear here, and administrators get an email for each."
      :ui="{ root: 'rounded-lg border border-dashed border-border' }"
    >
      <template #icon><icon-lucide-inbox class="size-5" /></template>
    </AppPlaceholder>
  </div>
</template>
