<script setup lang="ts">
import { useNow } from '@vueuse/core'
import { computed, watch } from 'vue'

import { useI18n } from '@open-pencil/vue'

import {
  cancelCloudConnect,
  changeCloudConnectServer,
  cloudConnectAddress,
  cloudConnectError,
  cloudConnectKind,
  cloudConnectOpen,
  cloudConnectServer,
  cloudConnectStep,
  cloudDeviceSignIn,
  cloudSignedIn,
  continueCloudConnect,
  reopenCloudSignInPage,
  signInToCloudServer
} from '@/app/cloud/connect/flow'
import { cloudServerHost } from '@/app/cloud/servers/address'
import { findCloudServer } from '@/app/cloud/servers/store'
import { cloudConnection } from '@/app/cloud/sessions/connection'
import { toast } from '@/app/shell/ui'
import { OFFICIAL_CLOUD_URL } from '@/constants'

import CloudConnectDialog from './CloudConnectDialog.vue'

/** The one connect dialog, driven by the app's connect flow wherever it was opened from. */
const { locale } = useI18n()
const now = useNow({ interval: 1000 })
const official = new URL(OFFICIAL_CLOUD_URL).host

const device = computed(() => {
  const state = cloudDeviceSignIn.value
  if (state.status !== 'waiting') return null
  const minutes = Math.max(1, Math.ceil((state.expiresAt - now.value.getTime()) / 60_000))
  const expiresIn = new Intl.NumberFormat(locale.value, {
    style: 'unit',
    unit: 'minute',
    unitDisplay: 'long'
  }).format(minutes)
  return { code: state.code, expiresIn }
})

// Coming back from the server's pages leaves no dialog open, so say where the person stands.
watch(cloudSignedIn, (signedIn) => {
  const server = signedIn ? findCloudServer(signedIn.serverId) : null
  if (!server) return
  const connection = cloudConnection(server.id)
  const host = cloudServerHost(server.url)
  if (connection.state === 'pending') {
    toast.info(`Your account on ${host} is waiting for an administrator to approve it.`)
  } else if (connection.state === 'signed-in' && connection.account) {
    toast.info(`Signed in to ${host} as ${connection.account.email}.`)
  }
})

function onOpenChange(open: boolean) {
  if (!open) cancelCloudConnect()
}
</script>

<template>
  <CloudConnectDialog
    :open="cloudConnectOpen"
    v-model:kind="cloudConnectKind"
    v-model:address="cloudConnectAddress"
    :step="cloudConnectStep"
    :official="official"
    :server="cloudConnectServer"
    :error="cloudConnectError"
    :device="device"
    :desktop="cloudConnectServer?.route === 'device'"
    @update:open="onOpenChange"
    @continue="continueCloudConnect"
    @change-server="changeCloudConnectServer"
    @sign-in="signInToCloudServer"
    @reopen-browser="reopenCloudSignInPage"
    @cancel="cancelCloudConnect"
  />
</template>
