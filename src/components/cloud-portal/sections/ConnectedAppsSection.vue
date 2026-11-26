<script setup lang="ts">
import { computed } from 'vue'

import type { CloudAppConnection } from '@open-pencil/cloud/contract'
import { useMessages } from '@open-pencil/vue/i18n'

import { appHost, scopeAccess } from '@/app/cloud-portal/apps'
import { usePortal } from '@/app/cloud-portal/context'
import { usePortalAction, usePortalLoad } from '@/app/cloud-portal/state'
import { useDateFormat } from '@/app/i18n/date'
import AppAlert from '@/components/ui/feedback/AppAlert.vue'

import PortalConnectedApps from '../account/PortalConnectedApps.vue'
import PortalLoadAlert from '../layout/PortalLoadAlert.vue'
import type { PortalAppConnection } from '../types'

/** The apps the signed-in person connected through OAuth: listing and disconnecting them. */
const portal = usePortal()
const messages = useMessages('cloud/portal')
const dates = useDateFormat()

const list = usePortalLoad(async () => (await portal.api.appConnections()).connections, [])

function portalConnection(connection: CloudAppConnection): PortalAppConnection {
  return {
    id: connection.id,
    name: connection.app.name,
    host: appHost(connection.app.uri),
    workspace: connection.workspace.name,
    access: scopeAccess(connection.scopes),
    connected: dates.format(connection.connectedAt, 'date')
  }
}
const connections = computed(() => (list.data.value ?? []).map(portalConnection))

const disconnect = usePortalAction(async (id: string) => {
  await portal.api.revokeAppConnection(id)
  await list.reload()
})

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
      v-if="disconnect.error.value"
      tone="error"
      :heading="messages.errorTitle"
      :description="disconnect.error.value"
    />
    <PortalConnectedApps
      v-if="list.status.value !== 'failed'"
      :connections="connections"
      :loading="loading"
      :busy="disconnect.busy.value"
      @disconnect="(id) => disconnect.run(id)"
    />
  </div>
</template>
