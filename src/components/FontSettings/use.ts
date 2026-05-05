import { computed, ref } from 'vue'

import type { LocalFontAccessState } from '@open-pencil/core/text'

import {
  clearDownloadedFontCache,
  downloadedFontCacheSummary,
  localFontAccessState,
  predownloadFallbackFonts,
  requestLocalFontAccess
} from '@/app/editor/fonts'

export interface FontCacheSummary {
  count: number
  byteLength: number
  updatedAt: number | null
}

export interface FontSettingsActions {
  clearDownloadedFontCache: () => Promise<void>
  downloadedFontCacheSummary: () => Promise<FontCacheSummary>
  localFontAccessState: () => LocalFontAccessState
  predownloadFallbackFonts: () => Promise<unknown>
  requestLocalFontAccess: () => Promise<string[]>
}

export type FontSettingsBusyAction = 'access' | 'download' | 'clear' | 'refresh'

const defaultActions: FontSettingsActions = {
  clearDownloadedFontCache,
  downloadedFontCacheSummary,
  localFontAccessState,
  predownloadFallbackFonts,
  requestLocalFontAccess
}

export function useFontSettings(actions: FontSettingsActions = defaultActions) {
  const cacheCount = ref(0)
  const cacheByteLength = ref(0)
  const cacheUpdatedAt = ref<number | null>(null)
  const accessState = ref(actions.localFontAccessState())
  const busyAction = ref<FontSettingsBusyAction | null>(null)
  const status = ref('')

  const accessStateLabel = computed(() => {
    if (accessState.value === 'granted') return 'Enabled'
    if (accessState.value === 'denied') return 'Denied'
    if (accessState.value === 'unsupported') return 'Unavailable'
    return 'Not requested'
  })

  const cacheSize = computed(() => {
    if (cacheByteLength.value === 0) return '0 MB'
    return `${(cacheByteLength.value / 1024 / 1024).toFixed(1)} MB`
  })

  const cacheUpdatedLabel = computed(() => {
    if (cacheUpdatedAt.value === null) return 'Never'
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
      status.value = 'Local font access enabled.'
    } catch {
      accessState.value = actions.localFontAccessState()
      status.value = 'Local font access was not granted.'
    } finally {
      busyAction.value = null
    }
  }

  async function downloadFallbacks() {
    busyAction.value = 'download'
    status.value = ''
    try {
      await actions.predownloadFallbackFonts()
      await refreshSummary()
      status.value = 'Fallback fonts downloaded.'
    } catch {
      status.value = 'Could not download fallback fonts.'
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
      status.value = 'Downloaded font cache cleared.'
    } catch {
      status.value = 'Could not clear downloaded font cache.'
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
    clearCache,
    downloadFallbacks,
    refreshSummary,
    requestAccess
  }
}
