import { useLocalStorage } from '@vueuse/core'

import { DEFAULT_SNAPPING_PREFERENCES, type SnappingPreferences } from '@open-pencil/core/editor'

import { DEFAULT_AGENT_STEPS, resolveAgentStepLimit } from '@/app/ai/chat/step-limit'

export const ANIMATION_PREFERENCES = ['system', 'off'] as const
export type AnimationPreference = (typeof ANIMATION_PREFERENCES)[number]

export const REASONING_DISPLAYS = ['collapsed', 'while-thinking', 'expanded'] as const
export type ReasoningDisplay = (typeof REASONING_DISPLAYS)[number]

export const CHANGE_PREVIEW_SIZES = ['off', 'small', 'medium', 'large'] as const
/** How large the before/after images kept for each AI edit are; `off` keeps only the JSX diff. */
export type ChangePreviewSize = (typeof CHANGE_PREVIEW_SIZES)[number]

export const CANVAS_RENDERING_MODES = ['retained', 'tiled'] as const
export type CanvasRenderingMode = (typeof CANVAS_RENDERING_MODES)[number]

export const DESIGN_CHECK_PRESETS = ['recommended', 'strict', 'accessibility'] as const
export type DesignCheckPreset = (typeof DESIGN_CHECK_PRESETS)[number]

export interface DesignCheckPreferences {
  /** Marks layers with errors and warnings on the canvas. */
  showOnCanvas: boolean
  preset: DesignCheckPreset
  /** Rules turned off on top of the preset. */
  disabledRules: string[]
}

export interface AppPreferences {
  appearance: { animations: AnimationPreference }
  chat: {
    reasoningDisplay: ReasoningDisplay
    maxAgentSteps: number
    changePreviewSize: ChangePreviewSize
  }
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
  designCheck: DesignCheckPreferences
}

export const DEFAULT_APP_PREFERENCES: Readonly<AppPreferences> = {
  appearance: { animations: 'system' },
  chat: {
    reasoningDisplay: 'collapsed',
    maxAgentSteps: DEFAULT_AGENT_STEPS,
    changePreviewSize: 'medium'
  },
  version: 1,
  recovery: { enabled: true },
  editing: {
    snapping: { ...DEFAULT_SNAPPING_PREFERENCES }
  },
  rendering: { canvasMode: 'retained' },
  designCheck: { showOnCanvas: true, preset: 'recommended', disabledRules: [] }
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
  chat?: { reasoningDisplay?: unknown; maxAgentSteps?: unknown; changePreviewSize?: unknown }
  recovery?: { enabled?: unknown }
  editing?: { snapping?: StoredSnappingPreferences }
  rendering?: { canvasMode?: unknown }
  designCheck?: { showOnCanvas?: unknown; preset?: unknown; disabledRules?: unknown }
}

function isStoredAppPreferences(value: unknown): value is StoredAppPreferences {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function normalizeAnimationPreference(value: unknown): AnimationPreference {
  return value === 'off' ? 'off' : 'system'
}

function normalizeChatPreferences(chat: StoredAppPreferences['chat']): AppPreferences['chat'] {
  return {
    maxAgentSteps: resolveAgentStepLimit(chat?.maxAgentSteps),
    reasoningDisplay:
      chat?.reasoningDisplay === 'expanded' || chat?.reasoningDisplay === 'while-thinking'
        ? chat.reasoningDisplay
        : 'collapsed',
    changePreviewSize: CHANGE_PREVIEW_SIZES.includes(chat?.changePreviewSize as ChangePreviewSize)
      ? (chat?.changePreviewSize as ChangePreviewSize)
      : DEFAULT_APP_PREFERENCES.chat.changePreviewSize
  }
}

function normalizeDesignCheckPreferences(
  designCheck: StoredAppPreferences['designCheck']
): DesignCheckPreferences {
  const preset = DESIGN_CHECK_PRESETS.find((candidate) => candidate === designCheck?.preset)
  const disabledRules = Array.isArray(designCheck?.disabledRules)
    ? designCheck.disabledRules.filter((rule): rule is string => typeof rule === 'string')
    : []
  return {
    showOnCanvas: booleanOrDefault(
      designCheck?.showOnCanvas,
      DEFAULT_APP_PREFERENCES.designCheck.showOnCanvas
    ),
    preset: preset ?? DEFAULT_APP_PREFERENCES.designCheck.preset,
    disabledRules: [...new Set(disabledRules)]
  }
}

function normalizePreferences(value: unknown): AppPreferences {
  const stored = isStoredAppPreferences(value) ? value : undefined
  const snapping = stored?.editing?.snapping

  return {
    appearance: { animations: normalizeAnimationPreference(stored?.appearance?.animations) },
    chat: normalizeChatPreferences(stored?.chat),
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
    },
    designCheck: normalizeDesignCheckPreferences(stored?.designCheck)
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

export function updateDesignCheckPreferences(changes: Partial<DesignCheckPreferences>): void {
  appPreferences.value = {
    ...appPreferences.value,
    designCheck: { ...appPreferences.value.designCheck, ...changes }
  }
}
