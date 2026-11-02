import { describe, expect, test } from 'bun:test'

import { DEFAULT_APP_PREFERENCES, parseAppPreferences } from '@/app/settings/preferences/store'

describe('parseAppPreferences', () => {
  test('starts from the defaults when nothing usable is stored', () => {
    for (const stored of [undefined, null, 'preferences', [], {}]) {
      expect(parseAppPreferences(stored)).toEqual(DEFAULT_APP_PREFERENCES)
    }
  })

  test('keeps a valid recent files limit and defaults missing or invalid limits to ten', () => {
    expect(parseAppPreferences({}).files.recentLimit).toBe(10)
    expect(parseAppPreferences({ files: { recentLimit: 25 } }).files.recentLimit).toBe(25)
    for (const recentLimit of [undefined, null, '25', 0, -1, 2.5, 1001, Infinity, Number.NaN]) {
      expect(parseAppPreferences({ files: { recentLimit } }).files.recentLimit).toBe(10)
    }
  })

  test('pings by default and treats an unreadable usage stats answer as never asked', () => {
    expect(DEFAULT_APP_PREFERENCES.sharing).toEqual({ dailyPing: true, usageStats: 'unset' })
    expect(
      parseAppPreferences({ sharing: { dailyPing: false, usageStats: 'maybe' } }).sharing
    ).toEqual({
      dailyPing: false,
      usageStats: 'unset'
    })
  })

  test('keeps valid choices and defaults only the fields that are not', () => {
    const preferences = parseAppPreferences({
      appearance: { animations: 'off' },
      chat: { reasoningDisplay: 'sometimes', changePreviewSize: 'large', maxAgentSteps: 'many' },
      editing: { snapping: { geometry: false, objects: 'yes' } }
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

  test('keeps a preset or a custom accent and falls back to blue for anything else', () => {
    const accent = (value: unknown) =>
      parseAppPreferences({ appearance: { accent: value } }).appearance.accent
    expect(accent({ kind: 'preset', preset: 'green' })).toEqual({ kind: 'preset', preset: 'green' })
    expect(accent({ kind: 'custom', color: '#ff6600' })).toEqual({
      kind: 'custom',
      color: '#FF6600'
    })
    for (const invalid of [
      { kind: 'preset', preset: 'teal' },
      { kind: 'custom', color: 'orange' },
      { kind: 'custom', color: '#f60' },
      '#ff6600'
    ]) {
      expect(accent(invalid)).toEqual(DEFAULT_APP_PREFERENCES.appearance.accent)
    }
    const preferences = parseAppPreferences({ appearance: { animations: 'off', accent: 'teal' } })
    expect(preferences.appearance.animations).toBe('off')
  })

  test('remembers that guided AI setup was finished or skipped', () => {
    expect(parseAppPreferences({ onboarding: { aiSetup: 'done' } }).onboarding.aiSetup).toBe('done')
    expect(parseAppPreferences({ onboarding: { aiSetup: 'later' } }).onboarding.aiSetup).toBe(
      'pending'
    )
  })

  test('keeps a listed zoom speed and defaults any other value to 1', () => {
    expect(parseAppPreferences({ navigation: { zoomSpeed: 0.25 } }).navigation.zoomSpeed).toBe(0.25)
    for (const zoomSpeed of [undefined, '0.5', 0, 0.3, 5, Number.NaN]) {
      expect(parseAppPreferences({ navigation: { zoomSpeed } }).navigation.zoomSpeed).toBe(1)
    }
  })

  test('keeps comment view choices and drops an unknown sort order', () => {
    const { comments } = parseAppPreferences({
      comments: { showOnCanvas: false, showResolved: true, sort: 'loudest' }
    })
    expect(comments).toEqual({
      ...DEFAULT_APP_PREFERENCES.comments,
      showOnCanvas: false,
      showResolved: true
    })
  })
})
