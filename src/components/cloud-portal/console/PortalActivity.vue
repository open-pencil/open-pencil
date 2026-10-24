<script setup lang="ts">
import { computed } from 'vue'

import { useCloudPortalMessages } from '@open-pencil/vue/i18n'

import AccountAvatar from '@/components/presence/AccountAvatar.vue'
import { portalList } from '@/theme/cloud-portal/list'

import type { PortalActivityEntry } from '../types'

/** What administrators did on the server, newest first. */
const { entries } = defineProps<{ entries: PortalActivityEntry[] }>()
const ui = portalList()
const messages = useCloudPortalMessages()
const actions = computed<Record<string, string>>(() => ({
  'enrollment.approved': messages.value.activityApproved,
  'enrollment.rejected': messages.value.activityRejected,
  'enrollment.revoked': messages.value.activityRevoked,
  'user.banned': messages.value.activitySuspended,
  'user.unbanned': messages.value.activityRestored,
  'user.sessions-revoked': messages.value.activitySignedOut,
  'user.admin-granted': messages.value.activityMadeAdmin,
  'user.admin-revoked': messages.value.activityRemovedAdmin,
  'email.regenerated': messages.value.activityEmailRetried,
  'user.two-step-reset': messages.value.activityTwoStepReset
}))
</script>

<template>
  <ul :class="ui.list()">
    <li v-for="entry in entries" :key="entry.id" :class="ui.row()">
      <AccountAvatar :id="entry.actor.id" :name="entry.actor.name" />
      <div :class="ui.body()">
        <p class="text-xs text-muted">
          <span class="font-medium text-surface">{{ entry.actor.name }}</span>
          {{ actions[entry.action] ?? messages.activityChanged }}
          <span class="text-surface">{{ entry.target }}</span>
        </p>
        <p v-if="entry.reason" :class="ui.detail()">
          {{ messages.activityReason({ reason: entry.reason }) }}
        </p>
      </div>
      <span :class="ui.meta()">{{ entry.when }}</span>
    </li>
  </ul>
</template>
