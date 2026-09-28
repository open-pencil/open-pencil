import { describe, expect, test } from 'bun:test'

import { checkCommand, smokeCommand, verifyCommand } from '#package-quality/commands'
import { renderUsage } from 'citty'

describe('package quality commands', () => {
  test('exposes stable check, smoke, and verify workflows', async () => {
    expect(checkCommand.meta?.name).toBe('check')
    expect(smokeCommand.meta?.name).toBe('smoke')
    expect(verifyCommand.meta?.name).toBe('verify')
    expect(await renderUsage(verifyCommand)).toContain('built-package smoke tests')
  })
})
