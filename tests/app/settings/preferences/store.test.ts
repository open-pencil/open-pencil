import { describe, expect, test } from 'bun:test'

import { DEFAULT_APP_PREFERENCES, parseAppPreferences } from '@/app/settings/preferences/store'

describe('parseAppPreferences', () => {
  test('starts from the defaults when nothing usable is stored', () => {
    for (const stored of [undefined, null, 'preferences', [], {}]) {
      expect(parseAppPreferences(stored)).toEqual(DEFAULT_APP_PREFERENCES)
    }
  })

  test('keeps valid choices and defaults only the fields that are not', () => {
    const preferences = parseAppPreferences({
      appearance: { animations: 'off' },
      chat: { reasoningDisplay: 'sometimes', changePreviewSize: 'large', maxAgentSteps: 'many' },
      editing: { snapping: { geometry: false, objects: 'yes' } },
      rendering: 'tiled'
    })
    expect(preferences.appearance.animations).toBe('off')
    expect(preferences.chat).toEqual({
      ...DEFAULT_APP_PREFERENCES.chat,
      changePreviewSize: 'large'
    })
    expect(preferences.editing.snapping).toEqual({
      ...DEFAULT_APP_PREFERENCES.editing.snapping,
      geometry: false
    })
    expect(preferences.rendering).toEqual(DEFAULT_APP_PREFERENCES.rendering)
  })

  test('keeps each disabled design check rule once and drops what is not a rule name', () => {
    const { designCheck } = parseAppPreferences({
      designCheck: { preset: 'strict', disabledRules: ['contrast', 7, 'contrast', 'spacing'] }
    })
    expect(designCheck).toEqual({
      showOnCanvas: true,
      preset: 'strict',
      disabledRules: ['contrast', 'spacing']
    })
  })

  test('remembers that guided AI setup was finished or skipped', () => {
    expect(parseAppPreferences({ onboarding: { aiSetup: 'done' } }).onboarding.aiSetup).toBe('done')
    expect(parseAppPreferences({ onboarding: { aiSetup: 'later' } }).onboarding.aiSetup).toBe(
      'pending'
    )
  })
})
