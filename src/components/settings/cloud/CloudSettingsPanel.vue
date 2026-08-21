<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'

import { useI18n } from '@open-pencil/vue'

import {
  cloudConnectionWorkSummary,
  hasPendingCloudConnectionWork,
  type CloudConnectionWorkSummary
} from '@/app/integrations/storage/cloud/pending-work'
import { cloudConnectionPresentation } from '@/app/integrations/storage/cloud/presentation'
import { useCloudStorageSettings } from '@/app/integrations/storage/cloud/settings'
import { settingsDialogOpen } from '@/app/settings/dialog'
import { toast } from '@/app/shell/ui'
import { openExternalURL } from '@/app/tauri/opener'
import ConnectCloudInstanceDialog from '@/components/settings/cloud/connect-instance/ConnectCloudInstanceDialog.vue'
import CloudEntitlementsSummary from '@/components/settings/storage/CloudEntitlementsSummary.vue'
import { AppAlertDialogRoot, AppDialogBody, AppDialogFooter } from '@/components/ui/dialog'
import AppBadge from '@/components/ui/AppBadge.vue'
import AppSelect from '@/components/ui/AppSelect.vue'
import { useButtonUI } from '@/components/ui/button'

const router = useRouter()
const { dialogs } = useI18n()
const cloud = useCloudStorageSettings()
const connectDialogOpen = ref(false)
const disconnectOpen = ref(false)
const disconnectSummary = ref<CloudConnectionWorkSummary | null>(null)
const connectionOptions = computed(() =>
  cloud.profiles.value.map((profile) => ({ value: profile.id, label: profile.label }))
)
const selectedConnection = computed({
  get: () => cloud.activeProfileId.value ?? '',
  set: (id: string) => void cloud.selectConnection(id)
})
const deviceAuth = computed(() => {
  const id = cloud.activeProfile.value?.id
  return id ? (cloud.deviceAuthByConnection.value[id] ?? { status: 'idle' as const }) : null
})
const presentation = computed(() =>
  cloudConnectionPresentation(cloud.state.value?.status ?? 'disconnected')
)
const statusCopy = computed(() => {
  switch (presentation.value.status) {
    case 'connected':
      return { label: dialogs.value.cloudStatusConnected, description: null }
    case 'unauthenticated':
      return {
        label: dialogs.value.cloudStatusSignInRequired,
        description: dialogs.value.cloudStatusSignInRequiredDescription
      }
    case 'authentication-required':
      return {
        label: dialogs.value.cloudStatusReauthenticationRequired,
        description: dialogs.value.cloudStatusReauthenticationRequiredDescription
      }
    case 'discovering':
      return { label: dialogs.value.cloudStatusConnecting, description: null }
    case 'offline':
      return {
        label: dialogs.value.cloudStatusOffline,
        description: dialogs.value.cloudStatusOfflineDescription
      }
    case 'error':
      return {
        label: dialogs.value.cloudStatusConnectionError,
        description: dialogs.value.cloudStatusConnectionErrorDescription
      }
    case 'disconnected':
      return {
        label: dialogs.value.cloudStatusDisconnected,
        description: dialogs.value.cloudStatusDisconnectedDescription
      }
  }
  throw new Error('Unknown Cloud connection status')
})
const primaryActionLabel = computed(() => {
  switch (presentation.value.primaryAction) {
    case 'open-workspace':
      return dialogs.value.cloudOpenWorkspace
    case 'reauthenticate':
      return dialogs.value.cloudReauthenticate
    case 'sign-in':
      return dialogs.value.cloudSignIn
    case 'reconnect':
      return dialogs.value.cloudReconnect
    case 'retry':
      return dialogs.value.cloudRetryConnection
  }
})
const badgeUI = computed(() => {
  if (presentation.value.tone === 'danger') return { base: 'bg-danger/10 text-danger' }
  if (presentation.value.tone === 'muted') return { base: 'bg-hover text-muted' }
  return undefined
})
const selectedWorkspace = computed({
  get: () => cloud.activeProfile.value?.selectedWorkspaceId ?? '',
  set: (id: string) => void cloud.selectWorkspace(id)
})
const primary = useButtonUI({ tone: 'accent', size: 'sm' })
const secondary = useButtonUI({ tone: 'ghost', size: 'sm', bordered: true })
const quiet = useButtonUI({ tone: 'ghost', size: 'sm' })

async function reopenDeviceBrowser(url: string) {
  await openExternalURL(url)
}

async function runPrimaryAction() {
  try {
    switch (presentation.value.primaryAction) {
      case 'open-workspace':
        await openWorkspace()
        break
      case 'reauthenticate':
        await cloud.reauthenticate()
        break
      case 'reconnect':
      case 'retry':
        await cloud.reconnect()
        break
      case 'sign-in': {
        const provider = cloud.state.value?.discovery?.authentication.socialProviders[0]
        if (!provider) throw new Error('This instance does not offer a sign-in provider')
        await cloud.signIn(provider)
        break
      }
    }
  } catch (error) {
    toast.error(error instanceof Error ? error.message : String(error))
  }
}

async function connectOfficial() {
  try {
    await cloud.addConnection('official')
  } catch (error) {
    toast.error(error instanceof Error ? error.message : String(error))
  }
}

async function connectSelfHosted(serverURL: string) {
  try {
    await cloud.addConnection('self-hosted', serverURL)
  } catch (error) {
    toast.error(error instanceof Error ? error.message : String(error))
  }
}

async function requestDisconnect() {
  const profile = cloud.activeProfile.value
  if (!profile) return
  disconnectSummary.value = await cloudConnectionWorkSummary(profile.id)
  disconnectOpen.value = true
}

function confirmDisconnect() {
  const profile = cloud.activeProfile.value
  if (!profile) return
  cloud.disconnectConnection(profile.id)
  disconnectOpen.value = false
}

async function openWorkspace() {
  settingsDialogOpen.value = false
  await router.push('/storage')
}
</script>

<template>
  <section class="flex flex-col gap-4" data-test-id="settings-cloud-panel">
    <div>
      <h3 class="text-xs font-semibold text-surface">Cloud connections</h3>
      <p class="mt-0.5 text-[10px] text-muted">
        Connect to OpenPencil Cloud or a self-hosted OpenPencil instance.
      </p>
    </div>

    <div>
      <button type="button" :class="primary.base" @click="connectDialogOpen = true">
        Connect instance
      </button>
    </div>

    <AppSelect
      v-if="connectionOptions.length"
      v-model="selectedConnection"
      label="Connected instance"
      :options="connectionOptions"
    />

    <article
      v-if="cloud.activeProfile.value"
      class="rounded border border-border bg-panel-field p-3"
    >
      <div class="flex items-start justify-between gap-3">
        <div class="min-w-0">
          <div class="flex items-center gap-2">
            <h4 class="truncate text-xs font-medium text-surface">
              {{ cloud.activeProfile.value.label }}
            </h4>
            <AppBadge :ui="{ base: 'bg-hover text-muted' }">
              {{ cloud.activeProfile.value.kind === 'official' ? 'Official' : 'Self-hosted' }}
            </AppBadge>
          </div>
          <p class="mt-0.5 truncate text-[10px] text-muted">
            {{ cloud.activeProfile.value.serverURL }}
          </p>
        </div>
        <AppBadge :ui="badgeUI">{{ statusCopy.label }}</AppBadge>
      </div>

      <p v-if="statusCopy.description" class="mt-3 text-[10px] text-muted">
        {{ statusCopy.description }}
      </p>

      <div v-if="cloud.state.value?.session" class="mt-3 flex items-center justify-between gap-2">
        <span class="truncate text-[10px] text-muted">
          {{ cloud.state.value.session.user.email }}
        </span>
        <button type="button" :class="quiet.base" @click="cloud.signOut">Sign out</button>
      </div>
      <div v-else-if="cloud.state.value" class="mt-3 flex gap-2">
        <button
          v-for="provider in cloud.state.value.discovery?.authentication.socialProviders ?? []"
          :key="provider"
          type="button"
          :class="secondary.base"
          @click="cloud.signIn(provider)"
        >
          Sign in with {{ provider }}
        </button>
      </div>

      <div
        v-if="deviceAuth?.status === 'waiting'"
        class="mt-3 rounded border border-border bg-hover/40 p-2 text-[10px] text-muted"
      >
        <p>Complete sign-in in your browser.</p>
        <p class="mt-1 font-mono text-xs text-surface">{{ deviceAuth.userCode }}</p>
        <div class="mt-2 flex gap-2">
          <button
            type="button"
            :class="quiet.base"
            @click="cloud.cancelDeviceAuth(cloud.activeProfile.value.id)"
          >
            Cancel
          </button>
          <button
            type="button"
            :class="secondary.base"
            @click="reopenDeviceBrowser(deviceAuth.verificationURL)"
          >
            Open browser again
          </button>
        </div>
      </div>
      <p
        v-else-if="deviceAuth && ['denied', 'expired', 'error'].includes(deviceAuth.status)"
        class="mt-3 text-[10px] text-danger"
      >
        {{ 'message' in deviceAuth ? deviceAuth.message : '' }}
      </p>

      <AppSelect
        v-if="cloud.workspaceOptions.value.length"
        v-model="selectedWorkspace"
        class="mt-3"
        label="Default workspace"
        :options="cloud.workspaceOptions.value"
      />
      <CloudEntitlementsSummary
        v-if="selectedWorkspace"
        class="mt-3"
        :entitlements="cloud.entitlements.value"
        :loading="cloud.entitlementsLoading.value"
        :error="cloud.entitlementsError.value"
        @retry="cloud.refreshEntitlements"
      />

      <div class="mt-3 flex justify-between border-t border-border pt-3">
        <button type="button" :class="primary.base" @click="runPrimaryAction">
          {{ primaryActionLabel }}
        </button>
        <button type="button" class="text-[10px] text-danger" @click="requestDisconnect">
          Disconnect instance
        </button>
      </div>
    </article>
    <AppAlertDialogRoot :open="disconnectOpen" size="sm" @update:open="disconnectOpen = $event">
      <AppDialogBody class="space-y-2">
        <h3 class="text-sm font-semibold text-surface">Disconnect instance?</h3>
        <p class="text-xs text-muted">
          <template v-if="disconnectSummary && hasPendingCloudConnectionWork(disconnectSummary)">
            {{
              disconnectSummary.pendingDocuments +
              disconnectSummary.conflictingDocuments +
              disconnectSummary.failedDocuments
            }}
            documents have unsynchronized local work and {{ disconnectSummary.queuedJobs }} queued
            jobs. Synchronization will pause until this instance is reconnected.
          </template>
          <template v-else>You can reconnect to this instance later.</template>
        </p>
      </AppDialogBody>
      <AppDialogFooter>
        <button type="button" :class="quiet.base" @click="disconnectOpen = false">Cancel</button>
        <button type="button" :class="secondary.base" @click="openWorkspace">Open workspace</button>
        <button type="button" class="text-xs text-danger" @click="confirmDisconnect">
          Disconnect anyway
        </button>
      </AppDialogFooter>
    </AppAlertDialogRoot>
    <ConnectCloudInstanceDialog
      v-model:open="connectDialogOpen"
      @connect-official="connectOfficial"
      @connect-self-hosted="connectSelfHosted"
    />
  </section>
</template>
