<script setup lang="ts">
import { ref, shallowRef, watch } from 'vue'

import { useCloudPortalMessages, useI18n } from '@open-pencil/vue'

import { usePortal } from '@/app/cloud-portal/context'
import { usePortalFailureMessages } from '@/app/cloud-portal/failure'
import { portalDate } from '@/app/cloud-portal/format'
import AppAlert from '@/components/ui/feedback/AppAlert.vue'

import PortalAccessRequests from '../console/PortalAccessRequests.vue'
import type { AccessRequest, AccessRequestStatus } from '../types'

const emit = defineEmits<{ changed: [] }>()
const portal = usePortal()
const messages = useCloudPortalMessages()
const { locale } = useI18n()
const failures = usePortalFailureMessages()
const filter = ref<AccessRequestStatus>('pending')
const requests = shallowRef<AccessRequest[]>([])
const busy = ref<string | null>(null)
const error = ref<string | null>(null)

async function load() {
  try {
    const { enrollments } = await portal.api.enrollments(filter.value)
    requests.value = enrollments.map((enrollment) => ({
      id: enrollment.id,
      name: enrollment.name,
      email: enrollment.email,
      reason: enrollment.reason,
      requestedOn: portalDate(enrollment.requestedAt, locale.value),
      status: enrollment.status,
      reviewedBy: enrollment.reviewedBy
    }))
  } catch (cause) {
    error.value = failures.api(cause)
  }
}

async function review(id: string, action: 'approve' | 'reject' | 'revoke') {
  busy.value = id
  error.value = null
  try {
    await portal.api.reviewEnrollment(id, action)
    emit('changed')
    await load()
  } catch (cause) {
    error.value = failures.api(cause)
  } finally {
    busy.value = null
  }
}

watch(filter, () => void load(), { immediate: true })
</script>

<template>
  <div class="flex flex-col gap-3">
    <AppAlert v-if="error" tone="error" :heading="messages.errorTitle" :description="error" />
    <PortalAccessRequests
      v-model:filter="filter"
      :requests="requests"
      :busy="busy"
      @approve="(id) => review(id, 'approve')"
      @reject="(id) => review(id, 'reject')"
      @revoke="(id) => review(id, 'revoke')"
    />
  </div>
</template>
