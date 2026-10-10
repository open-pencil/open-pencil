<script setup lang="ts">
import { onMounted, ref, shallowRef } from 'vue'

import { useCloudPortalMessages, useI18n } from '@open-pencil/vue'

import { usePortal } from '@/app/cloud-portal/context'
import { usePortalFailureMessages } from '@/app/cloud-portal/failure'
import { portalDate } from '@/app/cloud-portal/format'
import AppAlert from '@/components/ui/feedback/AppAlert.vue'

import PortalEmailDelivery from '../console/PortalEmailDelivery.vue'
import type { PortalEmail } from '../types'

const portal = usePortal()
const messages = useCloudPortalMessages()
const { locale } = useI18n()
const failures = usePortalFailureMessages()
const emails = shallowRef<PortalEmail[]>([])
const busy = ref<string | null>(null)
const error = ref<string | null>(null)

function deliveryStatus(status: string): PortalEmail['status'] {
  if (status === 'accepted') return 'sent'
  if (status === 'failed') return 'failed'
  if (status === 'suppressed') return 'suppressed'
  return 'waiting'
}

async function load() {
  try {
    const { messages: rows } = await portal.api.email()
    emails.value = rows.map((row) => ({
      id: row.id,
      kind: row.kind,
      recipient: row.recipientEmailNormalized,
      status: deliveryStatus(row.status),
      attempts: row.attemptCount,
      when: portalDate(row.nextAttemptAt, locale.value)
    }))
  } catch (cause) {
    error.value = failures.api(cause)
  }
}

async function retry(id: string) {
  busy.value = id
  error.value = null
  try {
    await portal.api.regenerateEmail(id)
    await load()
  } catch (cause) {
    error.value = failures.api(cause)
  } finally {
    busy.value = null
  }
}

onMounted(load)
</script>

<template>
  <div class="flex flex-col gap-3">
    <AppAlert v-if="error" tone="error" :heading="messages.errorTitle" :description="error" />
    <PortalEmailDelivery :emails="emails" :busy="busy" @retry="retry" />
  </div>
</template>
