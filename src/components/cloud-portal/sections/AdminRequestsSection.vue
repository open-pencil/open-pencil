<script setup lang="ts">
import { computed, ref, useTemplateRef } from 'vue'

import { useCloudPortalMessages, useI18n } from '@open-pencil/vue/i18n'

import { usePortal } from '@/app/cloud-portal/context'
import type { PortalListRequest } from '@/app/cloud-portal/list'
import { usePortalAction } from '@/app/cloud-portal/state'
import { formatDate } from '@/app/i18n/date'
import AppAlert from '@/components/ui/feedback/AppAlert.vue'

import PortalAccessRequests from '../console/PortalAccessRequests.vue'
import type { AccessRequestStatus } from '../types'

const emit = defineEmits<{ changed: [] }>()
const portal = usePortal()
const messages = useCloudPortalMessages()
const { locale } = useI18n()
const requests = useTemplateRef('requests')

/** The official server approves everyone waiting at once, each with the founder's letter. */
const official = portal.discovery.deployment === 'official'
const waiting = ref(0)
const invited = ref(false)
const invitation = computed(() => {
  if (invited.value) return 'sent'
  return official && waiting.value > 0 ? 'offered' : null
})

async function load(request: PortalListRequest<AccessRequestStatus>) {
  const { enrollments, total, counts } = await portal.api.enrollments(request)
  waiting.value = counts.pending
  const rows = enrollments.map((enrollment) => ({
    id: enrollment.id,
    name: enrollment.name,
    email: enrollment.email,
    reason: enrollment.reason,
    requestedOn: formatDate(enrollment.requestedAt, 'date', locale.value),
    status: enrollment.status,
    reviewedBy: enrollment.reviewedBy
      ? (enrollment.reviewerName ?? messages.value.someoneElse)
      : null,
    note: enrollment.reviewNote
  }))
  return { rows, total, counts }
}

const {
  subject: busy,
  error,
  run: review
} = usePortalAction(async (id: string, action: 'approve' | 'reject' | 'revoke', note?: string) => {
  await portal.api.reviewEnrollment(id, action, note)
  emit('changed')
  await requests.value?.reload()
})

const {
  busy: inviting,
  error: inviteError,
  run: invite
} = usePortalAction(async () => {
  await portal.api.inviteEnrollments()
  invited.value = true
  emit('changed')
  await requests.value?.reload()
})
</script>

<template>
  <div class="flex flex-col gap-3">
    <AppAlert
      v-if="error ?? inviteError"
      tone="error"
      :heading="messages.errorTitle"
      :description="error ?? inviteError ?? undefined"
    />
    <PortalAccessRequests
      ref="requests"
      :load="load"
      :busy="busy"
      :invitation="invitation"
      :inviting="inviting"
      @approve="(id) => review(id, 'approve')"
      @reject="(id, note) => review(id, 'reject', note)"
      @revoke="(id, note) => review(id, 'revoke', note)"
      @invite="invite()"
    />
  </div>
</template>
