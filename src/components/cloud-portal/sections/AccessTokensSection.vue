<script setup lang="ts">
import { computed, ref } from 'vue'

import type { CloudAccessToken, CloudAccessTokenCreate } from '@open-pencil/cloud/contract'
import { useCloudPortalMessages } from '@open-pencil/vue/i18n'

import { usePortal } from '@/app/cloud-portal/context'
import { usePortalAction, usePortalLoad } from '@/app/cloud-portal/state'
import { useDateFormat } from '@/app/i18n/date'
import AppAlert from '@/components/ui/feedback/AppAlert.vue'

import PortalAccessTokenDialog from '../account/PortalAccessTokenDialog.vue'
import PortalAccessTokens from '../account/PortalAccessTokens.vue'
import PortalLoadAlert from '../layout/PortalLoadAlert.vue'
import type { PortalAccessToken } from '../types'

/** The signed-in person's personal access tokens: making, listing, and revoking them. */
const portal = usePortal()
const messages = useCloudPortalMessages()
const dates = useDateFormat()

const list = usePortalLoad(async () => (await portal.api.accessTokens()).tokens, [])

function portalToken(token: CloudAccessToken): PortalAccessToken {
  const expired = token.expiresAt !== null && Date.parse(token.expiresAt) <= Date.now()
  return {
    id: token.id,
    name: token.name,
    start: token.start,
    created: dates.format(token.createdAt, 'date'),
    lastUsed: token.lastUsedAt ? dates.relative(token.lastUsedAt) : null,
    expires: token.expiresAt ? dates.format(token.expiresAt, 'date') : '—',
    expired
  }
}
const tokens = computed(() => (list.data.value ?? []).map(portalToken))

const creating = ref(false)
const created = ref<string | null>(null)
const create = usePortalAction(async (input: CloudAccessTokenCreate) => {
  created.value = (await portal.api.createAccessToken(input)).token
  await list.reload()
})
const revoke = usePortalAction(async (id: string) => {
  await portal.api.revokeAccessToken(id)
  await list.reload()
})

function startCreating() {
  create.clear()
  created.value = null
  creating.value = true
}
function setCreating(open: boolean) {
  creating.value = open
  // The token is gone from the page once its dialog closes.
  if (!open) created.value = null
}

/** What the table shows while the server answers. */
const loading = computed(() => {
  if (list.status.value === 'loading') return 'first'
  return list.status.value === 'refreshing' ? 'refresh' : false
})
</script>

<template>
  <div class="flex flex-col gap-4">
    <PortalLoadAlert v-if="list.error.value" :error="list.error.value" @retry="list.reload()" />
    <AppAlert
      v-if="revoke.error.value"
      tone="error"
      :heading="messages.errorTitle"
      :description="revoke.error.value"
    />
    <PortalAccessTokens
      v-if="list.status.value !== 'failed'"
      :tokens="tokens"
      :loading="loading"
      :busy="revoke.busy.value"
      @create="startCreating"
      @revoke="(id) => revoke.run(id)"
    />
    <PortalAccessTokenDialog
      :open="creating"
      :busy="create.busy.value"
      :error="create.error.value"
      :created="created"
      @update:open="setCreating"
      @submit="(input) => create.run(input)"
    />
  </div>
</template>
