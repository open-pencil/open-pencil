<script setup lang="ts">
import { useTemplateRef } from 'vue'

import type { CloudAdminEmailFilter } from '@open-pencil/cloud/contract'
import { useCloudPortalMessages, useI18n } from '@open-pencil/vue/i18n'

import { usePortal } from '@/app/cloud-portal/context'
import type { PortalListRequest } from '@/app/cloud-portal/list'
import { usePortalAction } from '@/app/cloud-portal/state'
import { formatDate } from '@/app/i18n/date'
import AppAlert from '@/components/ui/feedback/AppAlert.vue'

import PortalEmailDelivery from '../console/PortalEmailDelivery.vue'
import type { PortalEmail } from '../types'

const portal = usePortal()
const messages = useCloudPortalMessages()
const { locale } = useI18n()
const emails = useTemplateRef('emails')

function deliveryStatus(status: string): PortalEmail['status'] {
  if (status === 'accepted') return 'sent'
  if (status === 'failed') return 'failed'
  if (status === 'suppressed') return 'suppressed'
  return 'waiting'
}

async function load(request: PortalListRequest<CloudAdminEmailFilter>) {
  const { messages: sent, total, counts } = await portal.api.email(request)
  const rows = sent.map((row) => ({
    id: row.id,
    kind: row.kind,
    recipient: row.recipientEmailNormalized,
    status: deliveryStatus(row.status),
    attempts: row.attemptCount,
    when: formatDate(row.nextAttemptAt, 'dateTime', locale.value),
    error: row.lastErrorCode
  }))
  return { rows, total, counts }
}

const {
  subject: busy,
  error,
  run: retry
} = usePortalAction(async (id: string) => {
  await portal.api.regenerateEmail(id)
  await emails.value?.reload()
})
</script>

<template>
  <div class="flex flex-col gap-3">
    <AppAlert v-if="error" tone="error" :heading="messages.errorTitle" :description="error" />
    <PortalEmailDelivery ref="emails" :load="load" :busy="busy" @retry="retry" />
  </div>
</template>
