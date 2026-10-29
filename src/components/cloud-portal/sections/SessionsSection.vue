<script setup lang="ts">
import { computed } from 'vue'

import { useCloudPortalMessages } from '@open-pencil/vue/i18n'

import { usePortal } from '@/app/cloud-portal/context'
import { usePortalAction, usePortalLoad } from '@/app/cloud-portal/state'
import { useDateFormat } from '@/app/i18n/date'
import AppAlert from '@/components/ui/feedback/AppAlert.vue'

import PortalSessions from '../account/PortalSessions.vue'
import PortalLoadAlert from '../layout/PortalLoadAlert.vue'
import { portalSession, portalSignIn } from './sessions'

/** Where the signed-in person's account is signed in, its recent sign-ins, and signing them out. */
const portal = usePortal()
const messages = useCloudPortalMessages()
const dates = useDateFormat()

const activity = usePortalLoad(async () => {
  const [{ sessions }, { signIns }] = await Promise.all([
    portal.api.sessions(),
    portal.api.signIns()
  ])
  return { sessions, signIns }
}, null)

const sessions = computed(() =>
  (activity.data.value?.sessions ?? []).map((session) => portalSession(session, dates))
)
const signIns = computed(() =>
  (activity.data.value?.signIns ?? []).map((signIn) => portalSignIn(signIn, dates))
)

const change = usePortalAction(async (work: () => Promise<unknown>) => {
  await work()
  await activity.reload()
})
const error = computed(() => change.error.value)
/** What the tables show while the server answers. */
const loading = computed(() => {
  if (activity.status.value === 'loading') return 'first'
  return activity.status.value === 'refreshing' ? 'refresh' : false
})
</script>

<template>
  <div class="flex flex-col gap-4">
    <PortalLoadAlert
      v-if="activity.error.value"
      :error="activity.error.value"
      @retry="activity.reload()"
    />
    <AppAlert v-if="error" tone="error" :heading="messages.errorTitle" :description="error" />
    <PortalSessions
      v-if="activity.status.value !== 'failed'"
      manage
      :loading="loading"
      :sessions="sessions"
      :sign-ins="signIns"
      :busy="change.busy.value"
      @revoke="(id) => change.run(() => portal.api.revokeSession(id))"
      @revoke-others="change.run(() => portal.api.revokeOtherSessions())"
    />
  </div>
</template>
