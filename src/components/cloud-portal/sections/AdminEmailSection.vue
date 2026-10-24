<script setup lang="ts">
import { computed } from 'vue'

import { useCloudPortalMessages, useI18n } from '@open-pencil/vue/i18n'

import { usePortal } from '@/app/cloud-portal/context'
import { usePortalAction, usePortalLoad } from '@/app/cloud-portal/state'
import { formatDate } from '@/app/i18n/date'
import AppAlert from '@/components/ui/feedback/AppAlert.vue'

import PortalEmailDelivery from '../console/PortalEmailDelivery.vue'
import type { PortalEmail } from '../types'

const portal = usePortal()
const messages = useCloudPortalMessages()
const { locale } = useI18n()

function deliveryStatus(status: string): PortalEmail['status'] {
  if (status === 'accepted') return 'sent'
  if (status === 'failed') return 'failed'
  if (status === 'suppressed') return 'suppressed'
  return 'waiting'
}

const {
  data: emails,
  error: loadError,
  reload
} = usePortalLoad(async (): Promise<PortalEmail[]> => {
  const { messages: rows } = await portal.api.email()
  return rows.map((row) => ({
    id: row.id,
    kind: row.kind,
    recipient: row.recipientEmailNormalized,
    status: deliveryStatus(row.status),
    attempts: row.attemptCount,
    when: formatDate(row.nextAttemptAt, 'dateTime', locale.value),
    error: row.lastErrorCode
  }))
}, [])

const {
  subject: busy,
  error: retryError,
  run: retry
} = usePortalAction(async (id: string) => {
  await portal.api.regenerateEmail(id)
  await reload()
})
const error = computed(() => retryError.value ?? loadError.value)
</script>

<template>
  <div class="flex flex-col gap-3">
    <AppAlert v-if="error" tone="error" :heading="messages.errorTitle" :description="error" />
    <PortalEmailDelivery :emails="emails" :busy="busy" @retry="retry" />
  </div>
</template>
