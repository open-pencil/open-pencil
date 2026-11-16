import { afterEach, describe, expect, test } from 'bun:test'

import { effectScope } from 'vue'

import { BUILT_IN_DESIGN_PROMPT } from '@/app/ai/chat/system-prompt'
import { PROMPT_DEFINITIONS } from '@/app/ai/prompts/definitions'
import { useDesignPromptSetting, useTemplatePromptSetting } from '@/app/ai/prompts/settings/use'
import {
  appPreferences,
  DEFAULT_APP_PREFERENCES,
  updatePromptPreferences
} from '@/app/settings/preferences/store'

const scope = effectScope()

afterEach(() => {
  updatePromptPreferences(structuredClone(DEFAULT_APP_PREFERENCES.prompts))
})

/** Waits out the settle before a template is checked and previewed. */
async function settled(): Promise<void> {
  await Bun.sleep(400)
}

describe('a template prompt in Settings', () => {
  test('shows OpenPencil’s until the person writes their own', () => {
    const setting = scope.run(() => useTemplatePromptSetting('title'))
    expect(setting?.text.value).toBe(PROMPT_DEFINITIONS.title.template)
    expect(setting?.modified.value).toBe(false)
  })

  test('keeps what the person writes, and drops it on Reset', () => {
    const setting = scope.run(() => useTemplatePromptSetting('title'))
    if (!setting) throw new Error('no setting')
    setting.text.value = 'Name: {{ request }}'
    expect(appPreferences.value.prompts.title).toBe('Name: {{ request }}')
    expect(setting.modified.value).toBe(true)
    setting.reset()
    expect(appPreferences.value.prompts.title).toBeNull()
  })

  test('saves no change for text that is OpenPencil’s, so its later updates still apply', () => {
    const setting = scope.run(() => useTemplatePromptSetting('title'))
    if (!setting) throw new Error('no setting')
    setting.text.value = PROMPT_DEFINITIONS.title.template
    expect(appPreferences.value.prompts.title).toBeNull()
  })

  test('checks and previews the text once typing settles', async () => {
    const setting = scope.run(() => useTemplatePromptSetting('title'))
    if (!setting) throw new Error('no setting')
    setting.text.value = 'For {{ request }} and {{ nope }}'
    await settled()
    expect(setting.check.value.unknownVariables.map(({ message }) => message)).toEqual(['nope'])
    expect(setting.preview.value).toContain(String(PROMPT_DEFINITIONS.title.variables.request))
  })
})

describe('the Design prompt in Settings', () => {
  test('adds to OpenPencil’s by default, and is modified once either part changes', () => {
    const setting = scope.run(() => useDesignPromptSetting())
    if (!setting) throw new Error('no setting')
    expect(setting.mode.value).toBe('add')
    setting.mode.value = 'replace'
    expect(setting.modified.value).toBe(true)
    setting.reset()
    expect(appPreferences.value.prompts.design).toEqual(DEFAULT_APP_PREFERENCES.prompts.design)
  })

  test('starts from OpenPencil’s instructions on request', () => {
    const setting = scope.run(() => useDesignPromptSetting())
    if (!setting) throw new Error('no setting')
    setting.startFromBuiltIn()
    expect(appPreferences.value.prompts.design.text).toBe(BUILT_IN_DESIGN_PROMPT)
  })
})
