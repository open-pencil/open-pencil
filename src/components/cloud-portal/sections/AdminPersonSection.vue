<script setup lang="ts">
import { computed, watch } from 'vue'

import { CloudPortalAPIError } from '@open-pencil/cloud/client'
import { useCloudPortalMessages } from '@open-pencil/vue/i18n'

import { usePortal } from '@/app/cloud-portal/context'
import { usePortalAction, usePortalLoad } from '@/app/cloud-portal/state'
import { useDateFormat } from '@/app/i18n/date'
import AppButton from '@/components/ui/button/AppButton.vue'
import AppAlert from '@/components/ui/feedback/AppAlert.vue'
import AppPlaceholder from '@/components/ui/feedback/AppPlaceholder.vue'

import PortalPerson from '../console/PortalPerson.vue'
import PortalLoadAlert from '../layout/PortalLoadAlert.vue'
import PortalPageSkeleton from '../layout/PortalPageSkeleton.vue'
import type { PortalPersonAction, PortalPersonDetail } from '../types'
import { personAction, portalPerson } from './people'
import { portalSession, portalSignIn } from './sessions'

/** One account's page in the console, and what administrators do about it from there. */
const { userId } = defineProps<{ userId: string }>()
const emit = defineEmits<{ back: [] }>()
const portal = usePortal()
const messages = useCloudPortalMessages()
const dates = useDateFormat()

const loaded = usePortalLoad(async () => {
  try {
    return await portal.api.user(userId)
  } catch (error) {
    if (error instanceof CloudPortalAPIError && error.kind === 'domain') return 'missing' as const
    throw error
  }
}, null)
const detail = computed<PortalPersonDetail | null>(() => {
  const value = loaded.data.value
  if (!value || value === 'missing') return null
  return {
    person: portalPerson(value.user, portal.account.value?.user.userId, dates),
    emailVerified: value.user.emailVerified,
    methods: value.methods.map((method) => ({
      provider: method.provider,
      linkedOn: dates.format(method.createdAt, 'date')
    })),
    authenticator: value.authenticator,
    passkeyCount: value.passkeyCount,
    workspaces: value.workspaces,
    sessions: value.sessions.map((session) => portalSession(session, dates)),
    signIns: value.signIns.map((signIn) => portalSignIn(signIn, dates))
  }
})

const action = usePortalAction(async (change: () => Promise<unknown>) => {
  await change()
  await loaded.reload()
})
const error = computed(() => action.error.value)

function act(kind: PortalPersonAction, reason?: string) {
  const person = detail.value?.person
  if (person) void action.run(() => personAction(portal.api, person, kind, reason))
}

watch(
  () => userId,
  () => void loaded.reload()
)
</script>

<template>
  <div class="flex flex-col gap-4" :aria-busy="loaded.loading.value || undefined">
    <PortalLoadAlert
      v-if="loaded.error.value"
      :error="loaded.error.value"
      @retry="loaded.reload()"
    />
    <AppAlert v-if="error" tone="error" :heading="messages.errorTitle" :description="error" />
    <AppPlaceholder
      v-if="loaded.data.value === 'missing'"
      size="page"
      :label="messages.personNotFound"
      :description="messages.personNotFoundDescription"
      :ui="{ root: 'rounded-lg border border-dashed border-border' }"
    >
      <template #icon><icon-lucide-user-x class="size-5" /></template>
      <template #action>
        <AppButton size="sm" variant="outline" @click="emit('back')">
          {{ messages.backToPeople }}
        </AppButton>
      </template>
    </AppPlaceholder>
    <PortalPerson
      v-else-if="detail"
      :detail="detail"
      :busy="action.busy.value"
      @act="act"
      @back="emit('back')"
    />
    <PortalPageSkeleton v-else-if="loaded.status.value === 'loading'" avatar :groups="[5, 2]" />
  </div>
</template>
