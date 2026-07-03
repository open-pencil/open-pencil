import { computed, ref } from 'vue'

import type {
  FontFamilyOption,
  LocalFontAccessState,
  WebFontProviderId
} from '@open-pencil/core/text'
import { useI18n } from '@open-pencil/vue'

import {
  clearDownloadedFontCache,
  downloadedFontCacheSummary,
  fontProviderSettings,
  localFontAccessState,
  onlineFontsEnabled,
  predownloadFallbackFonts,
  requestLocalFontAccess,
  type FontProviderSettings
} from '@/app/editor/fonts'
import type { DownloadedFontCacheSummary } from '@/app/editor/fonts/cache'

type FontCacheSummary = DownloadedFontCacheSummary

export interface FontSettingsActions {
  clearDownloadedFontCache: () => Promise<void>
  downloadedFontCacheSummary: () => Promise<FontCacheSummary>
  localFontAccessState: () => LocalFontAccessState
  predownloadFallbackFonts: () => Promise<unknown>
  requestLocalFontAccess: () => Promise<string[] | FontFamilyOption[]>
  onlineFontsEnabled: { value: boolean }
  fontProviderSettings: { value: FontProviderSettings }
}

export type FontSettingsBusyAction = 'access' | 'download' | 'clear' | 'refresh'

const defaultActions: FontSettingsActions = {
  clearDownloadedFontCache,
  downloadedFontCacheSummary,
  localFontAccessState,
  predownloadFallbackFonts,
  requestLocalFontAccess,
  onlineFontsEnabled,
  fontProviderSettings
}

export function useFontSettings(actions: FontSettingsActions = defaultActions) {
  const { dialogs } = useI18n()
  const cacheCount = ref(0)
  const cacheByteLength = ref(0)
  const cacheUpdatedAt = ref<number | null>(null)
  const accessState = ref(actions.localFontAccessState())
  const busyAction = ref<FontSettingsBusyAction | null>(null)
  const status = ref('')
  const onlineFontsEnabled = actions.onlineFontsEnabled
  const fontProviderSettings = actions.fontProviderSettings

  const accessStateLabel = computed(() => {
    if (accessState.value === 'granted') return dialogs.value.enabled
    if (accessState.value === 'denied') return dialogs.value.denied
    if (accessState.value === 'unsupported') return dialogs.value.unavailable
    return dialogs.value.notRequested
  })

  const cacheSize = computed(() => {
    if (cacheByteLength.value === 0) return '0 MB'
    return `${(cacheByteLength.value / 1024 / 1024).toFixed(1)} MB`
  })

  const cacheUpdatedLabel = computed(() => {
    if (cacheUpdatedAt.value === null) return dialogs.value.never
    return new Date(cacheUpdatedAt.value).toLocaleDateString()
  })

  const canRequestLocalFonts = computed(
    () => accessState.value === 'prompt' || accessState.value === 'denied'
  )

  async function refreshSummary() {
    busyAction.value = busyAction.value ?? 'refresh'
    try {
      const summary = await actions.downloadedFontCacheSummary()
      cacheCount.value = summary.count
      cacheByteLength.value = summary.byteLength
      cacheUpdatedAt.value = summary.updatedAt
      accessState.value = actions.localFontAccessState()
    } finally {
      if (busyAction.value === 'refresh') busyAction.value = null
    }
  }

  async function requestAccess() {
    busyAction.value = 'access'
    status.value = ''
    try {
      await actions.requestLocalFontAccess()
      accessState.value = actions.localFontAccessState()
      status.value = dialogs.value.localFontAccessEnabled
    } catch {
      accessState.value = actions.localFontAccessState()
      status.value = dialogs.value.localFontAccessNotGranted
    } finally {
      busyAction.value = null
    }
  }

  function setOnlineFontsEnabled(enabled: boolean) {
    onlineFontsEnabled.value = enabled
    status.value = enabled
      ? dialogs.value.onlineFontProvidersEnabled
      : dialogs.value.onlineFontProvidersDisabled
  }

  function setFontProviderEnabled(provider: WebFontProviderId, enabled: boolean) {
    fontProviderSettings.value = { ...fontProviderSettings.value, [provider]: enabled }
    status.value = enabled
      ? dialogs.value.fontProviderEnabled({ provider })
      : dialogs.value.fontProviderDisabled({ provider })
  }

  async function downloadFallbacks() {
    busyAction.value = 'download'
    status.value = ''
    try {
      await actions.predownloadFallbackFonts()
      await refreshSummary()
      status.value = dialogs.value.fallbackFontsDownloaded
    } catch {
      status.value = dialogs.value.fallbackFontsDownloadFailed
    } finally {
      busyAction.value = null
    }
  }

  async function clearCache() {
    busyAction.value = 'clear'
    status.value = ''
    try {
      await actions.clearDownloadedFontCache()
      await refreshSummary()
      status.value = dialogs.value.downloadedFontCacheCleared
    } catch {
      status.value = dialogs.value.downloadedFontCacheClearFailed
    } finally {
      busyAction.value = null
    }
  }

  return {
    accessState,
    accessStateLabel,
    busyAction,
    canRequestLocalFonts,
    cacheCount,
    cacheSize,
    cacheUpdatedLabel,
    status,
    onlineFontsEnabled,
    fontProviderSettings,
    clearCache,
    downloadFallbacks,
    refreshSummary,
    requestAccess,
    setOnlineFontsEnabled,
    setFontProviderEnabled
  }
}
