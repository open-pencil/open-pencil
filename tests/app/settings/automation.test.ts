import { afterEach, beforeEach, expect, test } from 'bun:test'

import { toRaw } from 'vue'

import { allRules } from '@open-pencil/core/lint'
import { locale, setLocale } from '@open-pencil/vue'

import { readAutomationSettings, updateAutomationSettings } from '@/app/settings/automation'
import { appPreferences } from '@/app/settings/preferences/store'
import { getAppTheme, setAppTheme } from '@/app/shell/theme'

let previousPreferences: typeof appPreferences.value
let previousTheme: ReturnType<typeof getAppTheme>
let previousLocale: ReturnType<typeof locale.get>

beforeEach(() => {
  previousPreferences = structuredClone(toRaw(appPreferences.value))
  previousTheme = getAppTheme()
  previousLocale = locale.get()
})

afterEach(() => {
  appPreferences.value = previousPreferences
  setAppTheme(previousTheme)
  setLocale(previousLocale)
})

test('reads appearance from the theme and locale stores alongside app preferences', () => {
  setAppTheme('light')
  setLocale('de')
  const settings = readAutomationSettings()
  expect(settings.appearance).toEqual({
    theme: 'light',
    language: 'de',
    animations: appPreferences.value.appearance.animations,
    accent: appPreferences.value.appearance.accent
  })
  expect(settings.editing).toEqual(appPreferences.value.editing)
  expect(settings).not.toHaveProperty('version')
})

test('applies a nested partial update and keeps sibling settings', () => {
  const before = readAutomationSettings()
  const after = updateAutomationSettings({
    appearance: { theme: 'auto' },
    editing: { snapping: { pixelGrid: !before.editing.snapping.pixelGrid } },
    chat: { maxAgentSteps: 120 }
  })

  expect(after.appearance).toEqual({ ...before.appearance, theme: 'auto' })
  expect(after.editing.snapping).toEqual({
    ...before.editing.snapping,
    pixelGrid: !before.editing.snapping.pixelGrid
  })
  expect(after.chat).toEqual({ ...before.chat, maxAgentSteps: 120 })
  expect(after.recovery).toEqual(before.recovery)
  expect(appPreferences.value.chat.maxAgentSteps).toBe(120)
  expect(getAppTheme()).toBe('auto')
})

test('changes design check settings and lists them', () => {
  const rule = Object.keys(allRules)[0]
  const after = updateAutomationSettings({
    designCheck: { preset: 'strict', disabledRules: [rule], showOnCanvas: false }
  })
  expect(after.designCheck).toEqual({
    preset: 'strict',
    disabledRules: [rule],
    showOnCanvas: false
  })
  expect(appPreferences.value.designCheck.disabledRules).toEqual([rule])
})

test.each([
  [{ appearance: { theme: 'sepia' } }, 'appearance.theme'],
  [{ chat: { maxAgentSteps: 0 } }, 'chat.maxAgentSteps'],
  [{ editing: { snapping: { grid: true } } }, 'editing.snapping.grid'],
  [{ credentials: {} }, 'credentials'],
  [{ designCheck: { disabledRules: ['not-a-rule'] } }, 'designCheck.disabledRules.0']
])('rejects %p without changing anything', (patch, path) => {
  const before = readAutomationSettings()
  expect(() => updateAutomationSettings(patch)).toThrow(`Invalid settings at "${path}"`)
  expect(readAutomationSettings()).toEqual(before)
})

test('sets a preset or custom accent and rejects one that is not a color', () => {
  expect(
    updateAutomationSettings({ appearance: { accent: { kind: 'preset', preset: 'purple' } } })
      .appearance.accent
  ).toEqual({ kind: 'preset', preset: 'purple' })
  expect(
    updateAutomationSettings({ appearance: { accent: { kind: 'custom', color: '#ff6600' } } })
      .appearance.accent
  ).toEqual({ kind: 'custom', color: '#FF6600' })
  expect(() =>
    updateAutomationSettings({ appearance: { accent: { kind: 'custom', color: 'orange' } } })
  ).toThrow('appearance.accent')
  expect(appPreferences.value.appearance.accent).toEqual({ kind: 'custom', color: '#FF6600' })
})
