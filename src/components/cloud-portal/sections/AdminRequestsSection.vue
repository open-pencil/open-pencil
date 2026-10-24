<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import { useCloudPortalMessages, useI18n } from '@open-pencil/vue/i18n'

import { usePortal } from '@/app/cloud-portal/context'
import { usePortalAction, usePortalLoad } from '@/app/cloud-portal/state'
import { formatDate } from '@/app/i18n/date'
import AppAlert from '@/components/ui/feedback/AppAlert.vue'

import PortalAccessRequests from '../console/PortalAccessRequests.vue'
import type { AccessRequest, AccessRequestStatus } from '../types'

const emit = defineEmits<{ changed: [] }>()
const portal = usePortal()
const messages = useCloudPortalMessages()
const { locale } = useI18n()
const filter = ref<AccessRequestStatus>('pending')

const {
  data: requests,
  error: loadError,
  reload
} = usePortalLoad(async (): Promise<AccessRequest[]> => {
  const { enrollments } = await portal.api.enrollments(filter.value)
  return enrollments.map((enrollment) => ({
    id: enrollment.id,
    name: enrollment.name,
    email: enrollment.email,
    reason: enrollment.reason,
    requestedOn: formatDate(enrollment.requestedAt, 'date', locale.value),
    status: enrollment.status,
    reviewedBy: enrollment.reviewedBy,
    note: enrollment.reviewNote
  }))
}, [])

const {
  subject: busy,
  error: reviewError,
  run: review
} = usePortalAction(async (id: string, action: 'approve' | 'reject' | 'revoke', note?: string) => {
  await portal.api.reviewEnrollment(id, action, note)
  emit('changed')
  await reload()
})
const error = computed(() => reviewError.value ?? loadError.value)

watch(filter, () => void reload())
</script>

<template>
  <div class="flex flex-col gap-3">
    <AppAlert v-if="error" tone="error" :heading="messages.errorTitle" :description="error" />
    <PortalAccessRequests
      v-model:filter="filter"
      :requests="requests"
      :busy="busy"
      @approve="(id) => review(id, 'approve')"
      @reject="(id, note) => review(id, 'reject', note)"
      @revoke="(id, note) => review(id, 'revoke', note)"
    />
  </div>
</template>
