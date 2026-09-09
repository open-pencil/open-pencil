import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import { computed, onMounted, onScopeDispose, ref, watch } from 'vue'

import { IS_TAURI } from '@open-pencil/core/constants'

import { nativeCredentialAccessRevision, invalidateNativeCredentialAccess } from '../access-state'
import { browserCredentialsRemembered } from '../app'
import { setRememberCredentials } from '../media'
import { createCredentialAccessCheck } from './access-check'

export function useCredentialSettings() {
  const busy = ref(false)
  const { paused, checkFailed, check, invalidate } = createCredentialAccessCheck(() =>
    invoke<boolean>('credential_access_paused')
  )
  const failed = ref(false)
  let disposed = false
  let unlisten: (() => void) | undefined
  onScopeDispose(() => {
    disposed = true
    invalidate()
    unlisten?.()
  })
  onMounted(async () => {
    if (!IS_TAURI) return
    try {
      const stop = await listen('credential-access-changed', invalidateNativeCredentialAccess)
      if (disposed) stop()
      else {
        unlisten = stop
        invalidateNativeCredentialAccess()
      }
    } catch {
      if (!disposed) failed.value = true
    }
  })
  const remembered = computed({
    get: () => browserCredentialsRemembered.value,
    set: (value) => {
      void setRememberCredentials(value).catch(() => {
        failed.value = true
      })
    }
  })
  watch(
    nativeCredentialAccessRevision,
    async () => {
      if (IS_TAURI) await check()
    },
    { immediate: true }
  )
  async function retryCheck() {
    if (busy.value) return
    busy.value = true
    try {
      await check()
    } finally {
      busy.value = false
    }
  }
  async function retry() {
    if (busy.value) return
    busy.value = true
    failed.value = false
    try {
      await invoke('credential_retry_access')
      paused.value = false
      invalidateNativeCredentialAccess()
    } catch {
      failed.value = true
    } finally {
      busy.value = false
    }
  }
  return { busy, paused, failed, checkFailed, remembered, retry, retryCheck }
}
