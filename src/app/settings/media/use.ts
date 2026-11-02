import { tryOnScopeDispose } from '@vueuse/core'
import { computed, ref, watch } from 'vue'

import type { StockPhotoKeyCheck } from '@open-pencil/core/tools'

import { vectorizeProviderID } from '@/app/editor/vectorize'
import { useVectorizeSettings } from '@/app/editor/vectorize/settings/use'
import {
  checkMediaKey,
  pexelsKeyStatus,
  setPexelsKey,
  unsplashKeyStatus,
  setUnsplashKey
} from '@/app/settings/credentials/media'

export type MediaSettingsService = 'pexels' | 'unsplash' | 'vectorize'

const stockServices = {
  pexels: { status: pexelsKeyStatus, set: setPexelsKey },
  unsplash: { status: unsplashKeyStatus, set: setUnsplashKey }
}

export function useMediaSettingsEditor(service: MediaSettingsService, services = stockServices) {
  const key = ref('')
  const providerID = ref(vectorizeProviderID.value)
  const initialProvider = providerID.value
  const removeKey = ref(false)
  const busy = ref(false)
  const saveError = ref('')
  const keyCheck = ref<StockPhotoKeyCheck | 'missing' | 'checking' | null>(null)
  const vector = service === 'vectorize' ? useVectorizeSettings(key, providerID) : null
  let disposed = false
  tryOnScopeDispose(() => {
    disposed = true
    key.value = ''
  })
  // A result says nothing about a key typed since.
  watch(key, () => {
    if (keyCheck.value !== 'checking') keyCheck.value = null
  })
  watch(
    providerID,
    () => {
      removeKey.value = false
    },
    { flush: 'sync' }
  )

  const keyStatus = computed(() => {
    if (removeKey.value) return 'missing'
    return service === 'vectorize'
      ? (vector?.keyStatus.value ?? 'missing')
      : services[service].status.value
  })
  const error = computed(() => saveError.value || vector?.error.value || '')
  const dirty = computed(
    () => key.value.length > 0 || removeKey.value || providerID.value !== initialProvider
  )

  function clearCredential() {
    if (busy.value) return
    key.value = ''
    removeKey.value = true
    keyCheck.value = null
  }

  /** Tries the key typed, or the saved one, against the service; stock photo services only. */
  async function checkKey() {
    if (service === 'vectorize' || keyCheck.value === 'checking') return
    keyCheck.value = 'checking'
    const result = await checkMediaKey(service, key.value, !removeKey.value)
    if (!isDisposed()) keyCheck.value = result
  }

  function isDisposed() {
    return disposed
  }

  async function save(): Promise<boolean> {
    if (busy.value || isDisposed()) return false
    busy.value = true
    saveError.value = ''
    try {
      if (vector) {
        const saved =
          removeKey.value && !key.value.trim()
            ? await vector.clearCredential()
            : await vector.saveCredential()
        if (!saved || isDisposed()) return false
        vectorizeProviderID.value = providerID.value
      } else if (service !== 'vectorize' && (key.value.trim() || removeKey.value)) {
        await services[service].set(key.value.trim())
      }
      return !isDisposed()
    } catch (cause) {
      if (!isDisposed()) saveError.value = cause instanceof Error ? cause.message : String(cause)
      return false
    } finally {
      busy.value = false
    }
  }

  return {
    key,
    providerID,
    vector,
    keyStatus,
    keyCheck,
    error,
    dirty,
    busy,
    clearCredential,
    checkKey,
    save
  }
}
