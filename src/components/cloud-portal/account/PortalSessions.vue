<script setup lang="ts">
import { createColumnHelper } from '@tanstack/vue-table'
import { computed, h, ref, type Component } from 'vue'
import IconAppWindow from '~icons/lucide/app-window'
import IconGlobe from '~icons/lucide/globe'
import IconLogIn from '~icons/lucide/log-in'

import { useCloudPortalMessages } from '@open-pencil/vue/i18n'

import { usePortalDeviceLabels } from '@/app/cloud-portal/devices'
import { usePortalRows, type PortalTableFeatures } from '@/app/cloud-portal/list'
import SettingsSection from '@/components/settings/layout/SettingsSection.vue'
import AppButton from '@/components/ui/button/AppButton.vue'
import AppConfirmationDialog from '@/components/ui/dialog/AppConfirmationDialog.vue'
import { useHeldContent } from '@/components/ui/overlay/held'
import AppDataTable from '@/components/ui/table/AppDataTable.vue'

import PortalTextCell from '../table/PortalTextCell.vue'
import type { PortalDevice, PortalSession, PortalSignIn } from '../types'

/**
 * Where an account is signed in and when it signed in. On the person's own account each other
 * session can be signed out, one at a time or all together, each asked once more; an
 * administrator reads them as they are.
 */
const {
  sessions,
  signIns,
  manage = false,
  busy = false,
  loading = false
} = defineProps<{
  sessions: PortalSession[]
  signIns: PortalSignIn[]
  /** The person's own sessions, which they can sign out. */
  manage?: boolean
  busy?: boolean
  /** `first` before anything has loaded, `refresh` while it loads again. */
  loading?: 'first' | 'refresh' | false
}>()
const emit = defineEmits<{ revoke: [sessionId: string]; revokeOthers: [] }>()

const messages = useCloudPortalMessages()
const labels = usePortalDeviceLabels()
const others = computed(() => sessions.filter((session) => !session.current))
const confirming = ref<{ kind: 'one'; session: PortalSession } | { kind: 'others' } | null>(null)
const confirmingShown = useHeldContent(confirming)
const confirmation = computed(() => {
  const pending = confirmingShown.value
  if (!pending) return null
  const words = messages.value
  return pending.kind === 'others'
    ? {
        heading: words.signOutOtherSessionsHeading,
        description: words.signOutOtherSessionsDescription,
        confirm: words.signOutOtherSessions
      }
    : {
        heading: words.endSessionHeading({ device: labels.device(pending.session) }),
        description: words.endSessionDescription,
        confirm: words.signOut
      }
})

const signedInWith = (device: PortalDevice) =>
  device.method ? messages.value.signedInWith({ method: labels.method(device.method) }) : null

const address = {
  header: () => messages.value.columnAddress,
  meta: { class: 'hidden w-36 whitespace-nowrap text-muted tabular-nums @xl/table:table-cell' }
}
/** A device a session or sign-in came from, with how it signed in under it. */
function device(entry: PortalDevice, icon: Component, current = false) {
  return h(PortalTextCell, {
    icon,
    text: labels.device(entry),
    strong: true,
    badge: current ? messages.value.thisSession : null,
    detail: signedInWith(entry)
  })
}

const sessionColumn = createColumnHelper<PortalTableFeatures, PortalSession>()
const sessionTable = usePortalRows(() => sessions, {
  rowId: (session) => session.id,
  columns: sessionColumn.columns([
    sessionColumn.display({
      id: 'device',
      header: () => messages.value.columnDevice,
      cell: ({ row: { original: session } }) =>
        device(session, session.method === 'desktop' ? IconAppWindow : IconGlobe, session.current)
    }),
    sessionColumn.accessor('ipAddress', { id: 'address', ...address }),
    sessionColumn.accessor('signedInOn', {
      header: () => messages.value.columnSignedIn,
      meta: { class: 'hidden w-32 whitespace-nowrap text-muted @2xl/table:table-cell' }
    }),
    sessionColumn.accessor('lastActive', {
      header: () => messages.value.columnLastActive,
      meta: { class: 'w-32 whitespace-nowrap text-muted' }
    }),
    sessionColumn.display({
      id: 'actions',
      header: () => messages.value.columnActions,
      meta: { class: 'w-px text-right', actions: true },
      cell: ({ row: { original: session } }) =>
        session.current
          ? null
          : h(
              AppButton,
              {
                size: 'sm',
                variant: 'ghost',
                disabled: busy,
                onClick: () => {
                  confirming.value = { kind: 'one', session }
                }
              },
              () => messages.value.signOut
            )
    })
  ])
})
const signInColumn = createColumnHelper<PortalTableFeatures, PortalSignIn>()
const signInTable = usePortalRows(() => signIns, {
  rowId: (signIn) => signIn.id,
  columns: signInColumn.columns([
    signInColumn.display({
      id: 'device',
      header: () => messages.value.columnDevice,
      cell: ({ row: { original: signIn } }) => device(signIn, IconLogIn)
    }),
    signInColumn.accessor('ipAddress', { id: 'address', ...address }),
    signInColumn.accessor('when', {
      header: () => messages.value.columnWhen,
      meta: { class: 'w-44 whitespace-nowrap text-muted' }
    })
  ])
})

function confirm() {
  const pending = confirming.value
  confirming.value = null
  if (pending?.kind === 'others') emit('revokeOthers')
  else if (pending) emit('revoke', pending.session.id)
}
</script>

<template>
  <div class="flex max-w-3xl flex-col gap-6">
    <SettingsSection>
      <template #title>{{ messages.activeSessions }}</template>
      <template v-if="manage" #description>{{ messages.activeSessionsDescription }}</template>
      <template v-if="manage && others.length" #actions>
        <AppButton
          size="sm"
          variant="outline"
          :disabled="busy"
          @click="confirming = { kind: 'others' }"
        >
          {{ messages.signOutOtherSessions }}
        </AppButton>
      </template>
      <AppDataTable
        :table="sessionTable"
        :label="messages.activeSessions"
        :loading="loading"
        :loading-label="messages.loading"
        :hidden="manage ? [] : ['actions']"
      >
        <template #empty>
          <p class="text-center text-xs text-muted">{{ messages.noSessions }}</p>
        </template>
      </AppDataTable>
    </SettingsSection>

    <SettingsSection>
      <template #title>{{ messages.recentSignIns }}</template>
      <template v-if="manage" #description>{{ messages.recentSignInsDescription }}</template>
      <AppDataTable
        :table="signInTable"
        :label="messages.recentSignIns"
        :loading="loading"
        :loading-label="messages.loading"
      >
        <template #empty>
          <p class="text-center text-xs text-muted">{{ messages.noSignIns }}</p>
        </template>
      </AppDataTable>
    </SettingsSection>

    <AppConfirmationDialog
      :open="confirming !== null"
      tone="danger"
      :heading="confirmation?.heading ?? ''"
      :description="confirmation?.description"
      :cancel-label="messages.cancel"
      :confirm-label="confirmation?.confirm ?? ''"
      @update:open="(open) => !open && (confirming = null)"
      @confirm="confirm"
    />
  </div>
</template>
