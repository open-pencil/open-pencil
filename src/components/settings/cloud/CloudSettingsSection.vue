<script setup lang="ts">
import { computed, ref } from 'vue'

import { useCloudMessages, useCommonMessages } from '@open-pencil/vue'

import { openCloudConnect } from '@/app/cloud/connect/flow'
import { cloudServerHost } from '@/app/cloud/servers/address'
import {
  cloudServers,
  findCloudServer,
  homeCloudServer,
  removeCloudServer,
  showCloudServerOnHome
} from '@/app/cloud/servers/store'
import { cloudConnection, forgetCloudConnection } from '@/app/cloud/sessions/connection'
import { signOutOfCloud } from '@/app/cloud/sessions/sign-out'
import { clearCloudSessionToken } from '@/app/cloud/sessions/token'
import { openExternalLink, toast } from '@/app/shell/ui'
import AppConfirmationDialog from '@/components/ui/dialog/AppConfirmationDialog.vue'

import CloudSettingsPanel from './CloudSettingsPanel.vue'
import type { CloudServerEntry } from './types'

/** The Cloud section of Settings: the saved servers with their live sessions, and their actions. */
const t = useCloudMessages()
const common = useCommonMessages()
const entries = computed<CloudServerEntry[]>(() =>
  cloudServers.value.map((server) => {
    const connection = cloudConnection(server.id)
    const account = connection.account ?? server.account
    let session: CloudServerEntry['session'] = account ? 'signed-in' : 'signed-out'
    if (
      connection.state === 'pending' ||
      connection.state === 'closed' ||
      connection.state === 'expired' ||
      connection.state === 'signed-out'
    ) {
      session = connection.state
    }
    return {
      id: server.id,
      host: cloudServerHost(server.url),
      kind: server.kind,
      account,
      session,
      onHome: homeCloudServer.value?.id === server.id,
      unsaved: 0
    }
  })
)

const removing = ref<CloudServerEntry | null>(null)

function manageAccount(id: string) {
  const server = findCloudServer(id)
  if (server) void openExternalLink(new URL('/account', server.url).href)
}

async function signOut(id: string) {
  const discovery = cloudConnection(id).discovery
  if (!discovery) return
  try {
    await signOutOfCloud(id, discovery)
  } catch {
    toast.error(t.value.settingsSignOutFailed)
  }
}

async function remove() {
  const entry = removing.value
  removing.value = null
  if (!entry) return
  const discovery = cloudConnection(entry.id).discovery
  // End the session on the server when it answers; the app forgets the server either way.
  if (discovery && entry.session === 'signed-in') await signOut(entry.id)
  await clearCloudSessionToken(entry.id).catch(() => undefined)
  forgetCloudConnection(entry.id)
  removeCloudServer(entry.id)
}
</script>

<template>
  <div class="flex min-h-0 min-w-0 flex-1 flex-col">
    <CloudSettingsPanel
      :servers="entries"
      @connect="(kind) => openCloudConnect({ kind })"
      @sign-in="(id) => openCloudConnect({ serverId: id })"
      @manage-account="manageAccount"
      @show-on-home="showCloudServerOnHome"
      @sign-out="signOut"
      @remove="(id) => (removing = entries.find((entry) => entry.id === id) ?? null)"
    />
    <AppConfirmationDialog
      :open="removing !== null"
      tone="danger"
      :heading="t.settingsRemoveHeading({ host: removing?.host ?? '' })"
      :description="
        removing?.unsaved
          ? t.settingsRemoveUnsavedDescription(removing.unsaved)
          : t.settingsRemoveDescription
      "
      :cancel-label="common.cancel"
      :confirm-label="removing?.unsaved ? t.settingsRemoveAndDiscard : t.settingsRemove"
      @update:open="(open) => !open && (removing = null)"
      @confirm="remove"
    />
  </div>
</template>
