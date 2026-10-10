<script setup lang="ts">
import { useNow } from '@vueuse/core'
import { computed, watch } from 'vue'

import { useI18n } from '@open-pencil/vue'

import { cloudSignedIn } from '@/app/cloud/connect/flow'
import {
  acceptCloudInvitation,
  checkCloudInvitation,
  cloudInvitation,
  cloudInvitationAccount,
  cloudInvitationOpen,
  cloudInvitationState,
  dismissCloudInvitation,
  signInForCloudInvitation,
  switchCloudInvitationAccount
} from '@/app/cloud/invitations/flow'

import CloudInvitationDialog from './CloudInvitationDialog.vue'

/** The invitation an opened link names, until it is accepted or dismissed. */
const { locale } = useI18n()
const now = useNow({ interval: 60_000 })
const HOUR = 3_600_000

const summary = computed(() => {
  const invitation = cloudInvitation.value
  if (!invitation) return null
  const left = Date.parse(invitation.expiresAt) - now.value.getTime()
  const days = left >= 24 * HOUR
  const expiresIn = new Intl.NumberFormat(locale.value, {
    style: 'unit',
    unit: days ? 'day' : 'hour',
    unitDisplay: 'long'
  }).format(Math.max(1, Math.ceil(left / (days ? 24 * HOUR : HOUR))))
  return { ...invitation, expiresIn }
})

// Signing in for the invitation comes back here; check it again with the new account.
watch(cloudSignedIn, () => {
  if (cloudInvitationOpen.value) void checkCloudInvitation()
})
</script>

<template>
  <CloudInvitationDialog
    :open="cloudInvitationOpen"
    :state="cloudInvitationState"
    :invitation="summary"
    :account="cloudInvitationAccount"
    @update:open="(open) => !open && dismissCloudInvitation()"
    @accept="acceptCloudInvitation"
    @sign-in="signInForCloudInvitation"
    @switch-account="switchCloudInvitationAccount"
    @cancel="dismissCloudInvitation"
  />
</template>
