<script setup lang="ts">
import * as v from 'valibot'

import { useCloudPortalMessages, useI18n } from '@open-pencil/vue/i18n'

import { usePortal } from '@/app/cloud-portal/context'
import { usePortalLoad } from '@/app/cloud-portal/state'
import { formatDate } from '@/app/i18n/date'
import AppAlert from '@/components/ui/feedback/AppAlert.vue'

import PortalActivity from '../console/PortalActivity.vue'
import type { PortalActivityEntry } from '../types'

/** The reason an administrator gave, which the server keeps in the event's metadata. */
const reasonSchema = v.object({ reason: v.string() })
function eventReason(metadata: unknown): string | null {
  const parsed = v.safeParse(reasonSchema, metadata)
  return parsed.success ? parsed.output.reason : null
}

const portal = usePortal()
const messages = useCloudPortalMessages()
const { locale } = useI18n()

const { data: entries, error } = usePortalLoad(async (): Promise<PortalActivityEntry[]> => {
  const { events } = await portal.api.audit()
  return events.map((event) => ({
    id: event.id,
    actor: { id: event.actor.id, name: event.actor.name ?? messages.value.someoneElse },
    action: event.action,
    target: event.subject.name ?? event.subject.id,
    reason: eventReason(event.metadata),
    when: formatDate(event.createdAt, 'dateTime', locale.value)
  }))
}, [])
</script>

<template>
  <AppAlert v-if="error" tone="error" :heading="messages.errorTitle" :description="error" />
  <PortalActivity v-else :entries="entries" />
</template>
