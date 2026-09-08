import { computed, ref } from 'vue'

import { discoverCloud } from '@open-pencil/cloud/client'
import type { CloudDiscovery } from '@open-pencil/cloud/contract'

import { OFFICIAL_OPENPENCIL_CLOUD_URL } from '@/app/cloud/instances/profiles'
import { normalizeCloudServerURL } from '@/app/cloud/sessions/connection'

export type ConnectInstanceStep = 'choose-kind' | 'enter-url' | 'discovering' | 'ready' | 'error'
export type ConnectInstanceKind = 'official' | 'self-hosted'
export type InstanceVerificationFailure = 'invalid-address' | 'unsupported' | 'unavailable'

export function useConnectCloudInstance(discover: typeof discoverCloud = discoverCloud) {
  const step = ref<ConnectInstanceStep>('choose-kind')
  const kind = ref<ConnectInstanceKind | null>(null)
  const serverURL = ref('')
  const discovery = ref<CloudDiscovery | null>(null)
  const error = ref<InstanceVerificationFailure | null>(null)
  let generation = 0
  const canConfirm = computed(
    () =>
      step.value === 'ready' &&
      Boolean(discovery.value?.capabilities.documents && discovery.value.capabilities.workspaces)
  )

  function reset() {
    generation++
    step.value = 'choose-kind'
    kind.value = null
    serverURL.value = ''
    discovery.value = null
    error.value = null
  }
  function selectSelfHosted() {
    reset()
    kind.value = 'self-hosted'
    step.value = 'enter-url'
  }
  async function selectOfficial() {
    reset()
    kind.value = 'official'
    serverURL.value = OFFICIAL_OPENPENCIL_CLOUD_URL
    await verify()
  }
  async function verify() {
    const current = ++generation
    step.value = 'discovering'
    error.value = null
    discovery.value = null
    let normalized: string
    try {
      normalized = normalizeCloudServerURL(serverURL.value)
      const url = new URL(normalized)
      if (
        url.username ||
        url.password ||
        (url.protocol !== 'https:' && !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname))
      )
        throw new Error('Invalid instance address')
    } catch {
      error.value = 'invalid-address'
      step.value = 'error'
      return
    }
    serverURL.value = normalized
    try {
      const result = await discover(normalized)
      if (generation !== current) return
      if (!result.capabilities.documents || !result.capabilities.workspaces) {
        error.value = 'unsupported'
        step.value = 'error'
        return
      }
      discovery.value = result
      step.value = 'ready'
    } catch {
      if (generation !== current) return
      error.value = 'unavailable'
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
