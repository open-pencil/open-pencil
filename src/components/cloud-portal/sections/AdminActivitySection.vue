<script setup lang="ts">
import * as v from 'valibot'

import type { CloudAdminAuditFilter } from '@open-pencil/cloud/contract'
import { useCloudPortalMessages, useI18n } from '@open-pencil/vue/i18n'

import { usePortal } from '@/app/cloud-portal/context'
import type { PortalListRequest } from '@/app/cloud-portal/list'
import { formatDate } from '@/app/i18n/date'

import PortalActivity from '../console/PortalActivity.vue'

/** The reason an administrator gave, which the server keeps in the event's metadata. */
const reasonSchema = v.object({ reason: v.string() })
function eventReason(metadata: unknown): string | null {
  const parsed = v.safeParse(reasonSchema, metadata)
  return parsed.success ? parsed.output.reason : null
}

const portal = usePortal()
const messages = useCloudPortalMessages()
const { locale } = useI18n()

async function load(request: PortalListRequest<CloudAdminAuditFilter>) {
  const { events, total, counts } = await portal.api.audit(request)
  const rows = events.map((event) => ({
    id: event.id,
    actor: { id: event.actor.id, name: event.actor.name ?? messages.value.someoneElse },
    action: event.action,
    target: event.subject.name ?? event.subject.id,
    reason: eventReason(event.metadata),
    when: formatDate(event.createdAt, 'dateTime', locale.value)
  }))
  return { rows, total, counts }
}
</script>

<template>
  <PortalActivity :load="load" />
</template>
