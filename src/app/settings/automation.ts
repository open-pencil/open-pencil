import * as v from 'valibot'

import { AVAILABLE_LOCALES, locale, setLocale, type Locale } from '@open-pencil/vue'

import { agentStepLimitSchema } from '@/app/ai/chat/step-limit'
import { applySnappingPreferences } from '@/app/settings/preferences/apply'
import {
  ANIMATION_PREFERENCES,
  appPreferences,
  CANVAS_RENDERING_MODES,
  CHANGE_PREVIEW_SIZES,
  REASONING_DISPLAYS,
  type AppPreferences
} from '@/app/settings/preferences/store'
import { APP_THEMES, getAppTheme, setAppTheme, type AppTheme } from '@/app/shell/theme'

/**
 * The editor preferences that automation clients (CLI, MCP) may read and change.
 * Credentials, model profiles, MCP connections, storage, and tool access stay out:
 * an agent must not be able to grant itself access or read secrets.
 */
export interface AutomationSettings {
  appearance: {
    theme: AppTheme
    language: Locale
    animations: AppPreferences['appearance']['animations']
  }
  editing: AppPreferences['editing']
  rendering: AppPreferences['rendering']
  recovery: AppPreferences['recovery']
  chat: AppPreferences['chat']
}

const optionalBoolean = v.optional(v.boolean())

export const automationSettingsPatchSchema = v.strictObject({
  appearance: v.optional(
    v.strictObject({
      theme: v.optional(v.picklist(APP_THEMES)),
      language: v.optional(v.picklist(AVAILABLE_LOCALES)),
      animations: v.optional(v.picklist(ANIMATION_PREFERENCES))
    })
  ),
  editing: v.optional(
    v.strictObject({
      snapping: v.optional(
        v.strictObject({
          geometry: optionalBoolean,
          objects: optionalBoolean,
          pixelGrid: optionalBoolean
        })
      )
    })
  ),
  rendering: v.optional(
    v.strictObject({ canvasMode: v.optional(v.picklist(CANVAS_RENDERING_MODES)) })
  ),
  recovery: v.optional(v.strictObject({ enabled: optionalBoolean })),
  chat: v.optional(
    v.strictObject({
      reasoningDisplay: v.optional(v.picklist(REASONING_DISPLAYS)),
      maxAgentSteps: v.optional(agentStepLimitSchema),
      changePreviewSize: v.optional(v.picklist(CHANGE_PREVIEW_SIZES))
    })
  )
})

export type AutomationSettingsPatch = v.InferOutput<typeof automationSettingsPatchSchema>

export function readAutomationSettings(): AutomationSettings {
  // Copy leaf groups: stored preferences can hold reactive proxies that cannot be cloned.
  const preferences = appPreferences.value
  return {
    appearance: {
      theme: getAppTheme(),
      language: locale.get(),
      animations: preferences.appearance.animations
    },
    editing: { snapping: { ...preferences.editing.snapping } },
    rendering: { ...preferences.rendering },
    recovery: { ...preferences.recovery },
    chat: { ...preferences.chat }
  }
}

/** Validates a partial settings object, applies it through the owning stores, and returns the result. */
export function updateAutomationSettings(input: unknown): AutomationSettings {
  const result = v.safeParse(automationSettingsPatchSchema, input)
  if (!result.success) {
    const issue = result.issues[0]
    const path = v.getDotPath(issue)
    throw new Error(`Invalid settings${path ? ` at "${path}"` : ''}: ${issue.message}`)
  }
  const patch = result.output

  const { theme, language, ...appearance } = patch.appearance ?? {}
  if (theme) setAppTheme(theme)
  if (language) setLocale(language)

  const current = appPreferences.value
  appPreferences.value = {
    ...current,
    appearance: { ...current.appearance, ...appearance },
    rendering: { ...current.rendering, ...patch.rendering },
    recovery: { ...current.recovery, ...patch.recovery },
    chat: { ...current.chat, ...patch.chat }
  }
  if (patch.editing?.snapping) applySnappingPreferences(patch.editing.snapping)

  return readAutomationSettings()
}
