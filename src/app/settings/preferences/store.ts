import { useLocalStorage } from '@vueuse/core'
import { uniq } from 'es-toolkit'
import * as v from 'valibot'

import { DEFAULT_SNAPPING_PREFERENCES, type SnappingPreferences } from '@open-pencil/core/editor'
import { COMMENT_SORTS, type CommentSort } from '@open-pencil/scene-graph'

import { DEFAULT_AGENT_STEPS, resolveAgentStepLimit } from '@/app/ai/chat/step-limit'
import {
  accentPreferenceSchema,
  DEFAULT_ACCENT,
  type AccentPreference
} from '@/app/shell/accent/palette'

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

export interface CommentPreferences {
  /** Pins on the canvas outside the Comment tool; View → Comments, Shift+C. */
  showOnCanvas: boolean
  /** The comments list and the canvas also show resolved threads. */
  showResolved: boolean
  /** The comments list shows only the current page's threads. */
  onlyPage: boolean
  /** The comments list shows only threads you started or replied to. */
  onlyMine: boolean
  sort: CommentSort
}

/** Whether guided AI setup was offered and finished or skipped. */
export const AI_SETUP_STATES = ['pending', 'done'] as const
export type AISetupState = (typeof AI_SETUP_STATES)[number]

export interface AppPreferences {
  appearance: { animations: AnimationPreference; accent: AccentPreference }
  chat: {
    reasoningDisplay: ReasoningDisplay
    maxAgentSteps: number
    changePreviewSize: ChangePreviewSize
    /** Whether the view follows our AI agents while they work. */
    followAgents: boolean
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
  comments: CommentPreferences
  onboarding: {
    aiSetup: AISetupState
  }
}

export const DEFAULT_APP_PREFERENCES: Readonly<AppPreferences> = {
  appearance: { animations: 'system', accent: { ...DEFAULT_ACCENT } },
  chat: {
    reasoningDisplay: 'collapsed',
    maxAgentSteps: DEFAULT_AGENT_STEPS,
    changePreviewSize: 'medium',
    followAgents: true
  },
  version: 1,
  recovery: { enabled: true },
  editing: {
    snapping: { ...DEFAULT_SNAPPING_PREFERENCES }
  },
  rendering: { canvasMode: 'retained' },
  designCheck: { showOnCanvas: true, preset: 'recommended', disabledRules: [] },
  comments: {
    showOnCanvas: true,
    showResolved: false,
    onlyPage: false,
    onlyMine: false,
    sort: 'newest'
  },
  onboarding: { aiSetup: 'pending' }
}

const STORAGE_KEY = 'open-pencil:preferences:v1'

/** An object whose fields each fall back to their default, and that is all defaults when absent. */
function section<TEntries extends v.ObjectEntries>(entries: TEntries) {
  const schema = v.object(entries)
  return v.fallback(schema, () => v.parse(schema, {}))
}

const defaults = DEFAULT_APP_PREFERENCES
const snapping = defaults.editing.snapping

/** Stored preferences, read field by field so one bad value keeps the rest. */
const appPreferencesSchema = section({
  appearance: section({
    animations: v.fallback(v.picklist(ANIMATION_PREFERENCES), defaults.appearance.animations),
    accent: v.fallback(accentPreferenceSchema, () => ({ ...DEFAULT_ACCENT }))
  }),
  chat: section({
    reasoningDisplay: v.fallback(v.picklist(REASONING_DISPLAYS), defaults.chat.reasoningDisplay),
    maxAgentSteps: v.fallback(
      v.pipe(v.unknown(), v.transform(resolveAgentStepLimit)),
      defaults.chat.maxAgentSteps
    ),
    changePreviewSize: v.fallback(
      v.picklist(CHANGE_PREVIEW_SIZES),
      defaults.chat.changePreviewSize
    ),
    followAgents: v.fallback(v.boolean(), defaults.chat.followAgents)
  }),
  version: v.fallback(v.literal(1), 1),
  recovery: section({ enabled: v.fallback(v.boolean(), defaults.recovery.enabled) }),
  editing: section({
    snapping: section({
      geometry: v.fallback(v.boolean(), snapping.geometry),
      objects: v.fallback(v.boolean(), snapping.objects),
      pixelGrid: v.fallback(v.boolean(), snapping.pixelGrid)
    })
  }),
  rendering: section({
    canvasMode: v.fallback(v.picklist(CANVAS_RENDERING_MODES), defaults.rendering.canvasMode)
  }),
  designCheck: section({
    showOnCanvas: v.fallback(v.boolean(), defaults.designCheck.showOnCanvas),
    preset: v.fallback(v.picklist(DESIGN_CHECK_PRESETS), defaults.designCheck.preset),
    disabledRules: v.fallback(
      v.pipe(
        v.array(v.unknown()),
        v.transform((rules) => uniq(rules.filter((rule) => typeof rule === 'string')))
      ),
      () => []
    )
  }),
  comments: section({
    showOnCanvas: v.fallback(v.boolean(), defaults.comments.showOnCanvas),
    showResolved: v.fallback(v.boolean(), defaults.comments.showResolved),
    onlyPage: v.fallback(v.boolean(), defaults.comments.onlyPage),
    onlyMine: v.fallback(v.boolean(), defaults.comments.onlyMine),
    sort: v.fallback(v.picklist(COMMENT_SORTS), defaults.comments.sort)
  }),
  onboarding: section({
    aiSetup: v.fallback(v.picklist(AI_SETUP_STATES), defaults.onboarding.aiSetup)
  })
})

/** Reads stored preferences, keeping every valid field and defaulting the rest. */
export function parseAppPreferences(value: unknown): AppPreferences {
  return v.parse(appPreferencesSchema, value)
}

export const appPreferences = useLocalStorage<AppPreferences>(
  STORAGE_KEY,
  structuredClone(DEFAULT_APP_PREFERENCES),
  { mergeDefaults: (storageValue) => parseAppPreferences(storageValue) }
)

export function updateAnimationPreference(animations: AnimationPreference): void {
  appPreferences.value = {
    ...appPreferences.value,
    appearance: { ...appPreferences.value.appearance, animations }
  }
}

export function updateAccentPreference(accent: AccentPreference): void {
  appPreferences.value = {
    ...appPreferences.value,
    appearance: { ...appPreferences.value.appearance, accent }
  }
}

export function updateRecoveryEnabled(enabled: boolean): void {
  const preferences = structuredClone(appPreferences.value)
  preferences.recovery.enabled = enabled
  appPreferences.value = preferences
}

export function updateAISetupState(aiSetup: AISetupState): void {
  appPreferences.value = { ...appPreferences.value, onboarding: { aiSetup } }
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

export function updateCommentPreferences(changes: Partial<CommentPreferences>): void {
  appPreferences.value = {
    ...appPreferences.value,
    comments: { ...appPreferences.value.comments, ...changes }
  }
}
