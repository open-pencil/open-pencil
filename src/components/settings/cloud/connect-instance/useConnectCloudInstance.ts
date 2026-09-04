import { computed, ref } from 'vue'

import { discoverCloud } from '@open-pencil/cloud/client'
import type { CloudDiscovery } from '@open-pencil/cloud/contract'

import { normalizeCloudServerURL } from '@/app/integrations/storage/cloud/connection'
import { OFFICIAL_OPENPENCIL_CLOUD_URL } from '@/app/integrations/storage/cloud/profiles'

export type ConnectInstanceStep = 'choose-kind' | 'enter-url' | 'discovering' | 'ready' | 'error'
export type ConnectInstanceKind = 'official' | 'self-hosted'

function requireSecureInstance(serverURL: string): void {
  const url = new URL(serverURL)
  if (url.protocol === 'https:') return
  if (url.protocol === 'http:' && ['localhost', '127.0.0.1', '::1'].includes(url.hostname)) return
  throw new Error('Self-hosted Cloud instances must use HTTPS outside local development')
}

export function useConnectCloudInstance() {
  const step = ref<ConnectInstanceStep>('choose-kind')
  const kind = ref<ConnectInstanceKind | null>(null)
  const serverURL = ref('')
  const discovery = ref<CloudDiscovery | null>(null)
  const error = ref<string | null>(null)
  const canConfirm = computed(
    () => discovery.value?.capabilities.documents && discovery.value.capabilities.workspaces
  )

  function reset() {
    step.value = 'choose-kind'
    kind.value = null
    serverURL.value = ''
    discovery.value = null
    error.value = null
  }

  function selectSelfHosted(): void {
    kind.value = 'self-hosted'
    step.value = 'enter-url'
  }

  async function selectOfficial(): Promise<void> {
    kind.value = 'official'
    serverURL.value = OFFICIAL_OPENPENCIL_CLOUD_URL
    await verify()
  }

  async function verify() {
    step.value = 'discovering'
    error.value = null
    discovery.value = null
    try {
      const normalized = normalizeCloudServerURL(serverURL.value)
      requireSecureInstance(normalized)
      serverURL.value = normalized
      discovery.value = await discoverCloud(normalized)
      if (!canConfirm.value) {
        throw new Error('This instance does not support Cloud documents and workspaces')
      }
      step.value = 'ready'
    } catch (reason) {
      error.value = reason instanceof Error ? reason.message : String(reason)
      step.value = 'error'
    }
  }

  return {
    step,
    kind,
    serverURL,
    discovery,
    error,
    canConfirm,
    reset,
    selectOfficial,
    selectSelfHosted,
    verify
  }
}
