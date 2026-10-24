<script setup lang="ts">
import { compact } from 'es-toolkit'
import { computed, ref } from 'vue'

import { useCloudPortalMessages } from '@open-pencil/vue/i18n'

import { usePortalDeviceLabels } from '@/app/cloud-portal/devices'
import SettingsSection from '@/components/settings/layout/SettingsSection.vue'
import AppButton from '@/components/ui/button/AppButton.vue'
import AppConfirmationDialog from '@/components/ui/dialog/AppConfirmationDialog.vue'
import AppBadge from '@/components/ui/feedback/AppBadge.vue'
import { portalList } from '@/theme/cloud-portal/list'

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
  busy = false
} = defineProps<{
  sessions: PortalSession[]
  signIns: PortalSignIn[]
  /** The person's own sessions, which they can sign out. */
  manage?: boolean
  busy?: boolean
}>()
const emit = defineEmits<{ revoke: [sessionId: string]; revokeOthers: [] }>()

const ui = portalList()
const messages = useCloudPortalMessages()
const labels = usePortalDeviceLabels()
const others = computed(() => sessions.filter((session) => !session.current))
const confirming = ref<{ kind: 'one'; session: PortalSession } | { kind: 'others' } | null>(null)
const confirmation = computed(() => {
  const pending = confirming.value
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

const detail = (parts: (string | null)[]) => compact(parts).join(' · ')
const signedInWith = (device: PortalDevice) =>
  device.method ? messages.value.signedInWith({ method: labels.method(device.method) }) : null

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
      <ul v-if="sessions.length" :class="ui.list()">
        <li v-for="session in sessions" :key="session.id" :class="ui.row()">
          <icon-lucide-app-window
            v-if="session.method === 'desktop'"
            class="size-4 shrink-0 text-muted"
          />
          <icon-lucide-globe v-else class="size-4 shrink-0 text-muted" />
          <div :class="ui.body()">
            <p :class="ui.title()">
              {{ labels.device(session) }}
              <AppBadge v-if="session.current">{{ messages.thisSession }}</AppBadge>
            </p>
            <p :class="ui.detail()">
              {{
                detail([
                  messages.lastActive({ when: session.lastActive }),
                  session.ipAddress,
                  messages.signedInOn({ date: session.signedInOn }),
                  signedInWith(session)
                ])
              }}
            </p>
          </div>
          <AppButton
            v-if="manage && !session.current"
            size="sm"
            variant="ghost"
            :disabled="busy"
            @click="confirming = { kind: 'one', session }"
          >
            {{ messages.signOut }}
          </AppButton>
        </li>
      </ul>
      <p v-else class="rounded border border-dashed border-border px-3 py-3 text-xs text-muted">
        {{ messages.noSessions }}
      </p>
    </SettingsSection>

    <SettingsSection>
      <template #title>{{ messages.recentSignIns }}</template>
      <template v-if="manage" #description>{{ messages.recentSignInsDescription }}</template>
      <ul v-if="signIns.length" :class="ui.list()">
        <li v-for="signIn in signIns" :key="signIn.id" :class="ui.row()">
          <icon-lucide-log-in class="size-4 shrink-0 text-muted" />
          <div :class="ui.body()">
            <p :class="ui.title()">{{ labels.device(signIn) }}</p>
            <p :class="ui.detail()">{{ detail([signIn.ipAddress, signedInWith(signIn)]) }}</p>
          </div>
          <span :class="ui.meta()">{{ signIn.when }}</span>
        </li>
      </ul>
      <p v-else class="rounded border border-dashed border-border px-3 py-3 text-xs text-muted">
        {{ messages.noSignIns }}
      </p>
    </SettingsSection>

    <AppConfirmationDialog
      :open="confirmation !== null"
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
