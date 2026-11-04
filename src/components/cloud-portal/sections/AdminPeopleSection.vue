<script setup lang="ts">
import { computed, useTemplateRef } from 'vue'

import type { CloudAdminUserFilter } from '@open-pencil/cloud/contract'
import { useCloudPortalMessages } from '@open-pencil/vue/i18n'

import { usePortal } from '@/app/cloud-portal/context'
import type { PortalListRequest } from '@/app/cloud-portal/list'
import { usePortalAction } from '@/app/cloud-portal/state'
import { useDateFormat } from '@/app/i18n/date'
import AppAlert from '@/components/ui/feedback/AppAlert.vue'

import PortalPeople from '../console/PortalPeople.vue'
import { personAction, portalPerson } from './people'

/** The accounts on this server, a page at a time, and what administrators do about them. */
const emit = defineEmits<{ total: [count: number]; open: [personId: string] }>()
const portal = usePortal()
const messages = useCloudPortalMessages()
const dates = useDateFormat()
const people = useTemplateRef('people')

async function load(request: PortalListRequest<CloudAdminUserFilter>) {
  const { users, total, counts } = await portal.api.users(request)
  // The page's own count is of every account, not of those a search finds.
  if (!request.search) emit('total', counts.all)
  const you = portal.account.value?.user.userId
  return { rows: users.map((user) => portalPerson(user, you, dates)), total, counts }
}

const action = usePortalAction(async (change: () => Promise<unknown>) => {
  await change()
  await people.value?.reload()
})
const error = computed(() => action.error.value)
</script>

<template>
  <div class="flex flex-col gap-3">
    <AppAlert v-if="error" tone="error" :heading="messages.errorTitle" :description="error" />
    <PortalPeople
      ref="people"
      :load="load"
      :busy="action.busy.value"
      @act="
        (person, kind, reason) => action.run(() => personAction(portal.api, person, kind, reason))
      "
      @open="(id) => emit('open', id)"
    />
  </div>
</template>
