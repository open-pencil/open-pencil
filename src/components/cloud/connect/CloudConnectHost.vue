<script setup lang="ts">
import { useDocumentVisibility, useNow } from '@vueuse/core'
import { computed, watch } from 'vue'

import { useCloudMessages, useI18n } from '@open-pencil/vue/i18n'

import {
  backCloudConnect,
  cancelCloudConnect,
  cloudConnectAddress,
  cloudConnectBusy,
  cloudConnectCanGoBack,
  cloudConnectChoosing,
  cloudConnectEmail,
  cloudConnectError,
  cloudConnectFailure,
  cloudConnectKind,
  cloudConnectOpen,
  cloudConnectResent,
  cloudConnectServer,
  cloudConnectStep,
  cloudDeviceSignIn,
  cloudForgotPasswordURL,
  cloudSignedIn,
  continueAfterCloudVerification,
  continueCloudConnect,
  reopenCloudSignInPage,
  resendCloudVerificationEmail,
  showCloudSignUp,
  signInToCloudServer,
  signInWithCloudEmail,
  signUpWithCloudEmail
} from '@/app/cloud/connect/flow'
import { cloudServerHost } from '@/app/cloud/servers/address'
import { findCloudServer } from '@/app/cloud/servers/store'
import { cloudConnection } from '@/app/cloud/sessions/connection'
import { openExternalLink, toast } from '@/app/shell/ui'
import { useHeldContent } from '@/components/ui/overlay/held'
import { OFFICIAL_CLOUD_URL } from '@/constants'

import CloudConnectDialog from './CloudConnectDialog.vue'

/** The one connect dialog, driven by the app's connect flow wherever it was opened from. */
const { locale } = useI18n()
const t = useCloudMessages()
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
    toast.info(t.value.accountPending({ host }))
  } else if (connection.state === 'signed-in' && connection.account) {
    toast.info(t.value.signedInAs({ host, email: connection.account.email }))
  }
})

// Cancelling resets the attempt as the dialog closes; it keeps drawing the step it was on.
const shown = useHeldContent(
  () => ({
    step: cloudConnectStep.value,
    choosing: cloudConnectChoosing.value,
    server: cloudConnectServer.value,
    error: cloudConnectError.value,
    failure: cloudConnectFailure.value,
    busy: cloudConnectBusy.value,
    email: cloudConnectEmail.value,
    resent: cloudConnectResent.value,
    device: device.value,
    canGoBack: cloudConnectCanGoBack.value
  }),
  cloudConnectOpen
)

function onOpenChange(open: boolean) {
  if (!open) cancelCloudConnect()
}

// Coming back from the email's link is the signal to finish signing in.
const visibility = useDocumentVisibility()
watch(visibility, (state) => {
  if (state === 'visible' && cloudConnectStep.value === 'verify') {
    void continueAfterCloudVerification()
  }
})

function forgotPassword() {
  const url = cloudForgotPasswordURL()
  if (url) void openExternalLink(url)
}
</script>

<template>
  <CloudConnectDialog
    :open="cloudConnectOpen"
    v-model:kind="cloudConnectKind"
    v-model:address="cloudConnectAddress"
    :step="shown.step"
    :official="official"
    :choosing="shown.choosing"
    :server="shown.server"
    :error="shown.error"
    :failure="shown.failure"
    :busy="shown.busy"
    :email="shown.email"
    :resent="shown.resent"
    :device="shown.device"
    :desktop="shown.server?.route === 'device'"
    :can-go-back="shown.canGoBack"
    @update:open="onOpenChange"
    @continue="continueCloudConnect"
    @back="backCloudConnect"
    @sign-in="signInToCloudServer"
    @sign-in-with-email="signInWithCloudEmail"
    @sign-up="signUpWithCloudEmail"
    @show-sign-up="showCloudSignUp"
    @verified="continueAfterCloudVerification"
    @resend="resendCloudVerificationEmail"
    @forgot-password="forgotPassword"
    @reopen-browser="reopenCloudSignInPage"
    @cancel="cancelCloudConnect"
  />
</template>
