import { useLocalStorage } from '@vueuse/core'

import { DEFAULT_SNAPPING_PREFERENCES, type SnappingPreferences } from '@open-pencil/core/editor'

export type AnimationPreference = 'system' | 'off'

export type ReasoningDisplay = 'collapsed' | 'while-thinking' | 'expanded'

export type CanvasRenderingMode = 'retained' | 'tiled'

export interface AppPreferences {
  appearance: { animations: AnimationPreference }
  chat: { reasoningDisplay: ReasoningDisplay }
  version: 1
  recovery: {
    enabled: boolean
  }
  editing: {
    snapping: SnappingPreferences
  }
  rendering: {
    canvasMode: CanvasRenderingMode
  }
}

export const DEFAULT_APP_PREFERENCES: Readonly<AppPreferences> = {
  appearance: { animations: 'system' },
  chat: { reasoningDisplay: 'collapsed' },
  version: 1,
  recovery: { enabled: true },
  editing: {
    snapping: { ...DEFAULT_SNAPPING_PREFERENCES }
  },
  rendering: { canvasMode: 'retained' }
}

const STORAGE_KEY = 'open-pencil:preferences:v1'

function booleanOrDefault(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback
}

interface StoredSnappingPreferences {
  geometry?: unknown
  objects?: unknown
  pixelGrid?: unknown
}

interface StoredAppPreferences {
  appearance?: { animations?: unknown }
  chat?: { reasoningDisplay?: unknown }
  recovery?: { enabled?: unknown }
  editing?: { snapping?: StoredSnappingPreferences }
  rendering?: { canvasMode?: unknown }
}

function isStoredAppPreferences(value: unknown): value is StoredAppPreferences {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function normalizeAnimationPreference(value: unknown): AnimationPreference {
  return value === 'off' ? 'off' : 'system'
}

function normalizePreferences(value: unknown): AppPreferences {
  const stored = isStoredAppPreferences(value) ? value : undefined
  const snapping = stored?.editing?.snapping

  return {
    appearance: { animations: normalizeAnimationPreference(stored?.appearance?.animations) },
    chat: {
      reasoningDisplay:
        stored?.chat?.reasoningDisplay === 'expanded' ||
        stored?.chat?.reasoningDisplay === 'while-thinking'
          ? stored.chat.reasoningDisplay
          : 'collapsed'
    },
    version: 1,
    recovery: {
      enabled: booleanOrDefault(stored?.recovery?.enabled, DEFAULT_APP_PREFERENCES.recovery.enabled)
    },
    editing: {
      snapping: {
        geometry: booleanOrDefault(
          snapping?.geometry,
          DEFAULT_APP_PREFERENCES.editing.snapping.geometry
        ),
        objects: booleanOrDefault(
          snapping?.objects,
          DEFAULT_APP_PREFERENCES.editing.snapping.objects
        ),
        pixelGrid: booleanOrDefault(
          snapping?.pixelGrid,
          DEFAULT_APP_PREFERENCES.editing.snapping.pixelGrid
        )
      }
    },
    rendering: {
      canvasMode: stored?.rendering?.canvasMode === 'tiled' ? 'tiled' : 'retained'
    }
  }
}

export const appPreferences = useLocalStorage<AppPreferences>(
  STORAGE_KEY,
  structuredClone(DEFAULT_APP_PREFERENCES),
  { mergeDefaults: (storageValue) => normalizePreferences(storageValue) }
)

export function updateAnimationPreference(animations: AnimationPreference): void {
  appPreferences.value = { ...appPreferences.value, appearance: { animations } }
}

export function updateRecoveryEnabled(enabled: boolean): void {
  const preferences = structuredClone(appPreferences.value)
  preferences.recovery.enabled = enabled
  appPreferences.value = preferences
}

export function updateCanvasRenderingMode(canvasMode: CanvasRenderingMode): void {
  appPreferences.value = {
    ...appPreferences.value,
    rendering: { canvasMode }
  }
}

export function updateSnappingPreferences(changes: Partial<SnappingPreferences>): void {
  appPreferences.value = {
    ...appPreferences.value,
    editing: {
      ...appPreferences.value.editing,
      snapping: {
        ...appPreferences.value.editing.snapping,
        ...changes
      }
    }
  }
}
