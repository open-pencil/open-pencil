import { expect, test } from 'bun:test'

import * as v from 'valibot'

import {
  requiredSetting,
  requiredSettingsURL,
  validSettingsURL
} from '@/app/settings/validation/schema'

test('settings URL validation accepts HTTP(S) endpoints but never embedded credentials', () => {
  for (const value of [
    'https://example.com/v1',
    'http://localhost:11434/v1',
    'http://127.0.0.1:9000'
  ]) {
    expect(validSettingsURL(value)).toBe(true)
  }
  for (const value of [
    '',
    'example.com',
    'file:///tmp/config',
    // eslint-disable-next-line no-script-url -- Rejection fixture; this URL is never executed.
    'javascript:alert(1)',
    'https://user:secret@example.com',
    'https://user@example.com'
  ]) {
    expect(validSettingsURL(value)).toBe(false)
  }
})

test('required fields and URL failures use supplied translated messages', () => {
  const messages = { requiredField: 'Это поле обязательно.', invalidURL: 'Неверный адрес.' }
  const required = v.safeParse(requiredSetting(messages.requiredField), '  ')
  expect(required.success).toBe(false)
  if (!required.success) expect(required.issues[0]?.message).toBe(messages.requiredField)
  const invalid = v.safeParse(requiredSettingsURL(messages), 'ftp://example.com')
  expect(invalid.success).toBe(false)
  if (!invalid.success) expect(invalid.issues[0]?.message).toBe(messages.invalidURL)
  expect(v.parse(requiredSettingsURL(messages), ' https://example.com/v1 ')).toBe(
    'https://example.com/v1'
  )
})
