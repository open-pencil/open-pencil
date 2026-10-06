import { describe, expect, test } from 'bun:test'

import { checkCommand, smokeCommand, verifyCommand } from '#package-quality/commands'
import { renderUsage, type ArgsDef, type CommandDef } from 'citty'

async function metaName<T extends ArgsDef>(command: CommandDef<T>): Promise<string | undefined> {
  const meta = await (typeof command.meta === 'function' ? command.meta() : command.meta)
  return meta?.name
}

describe('package quality commands', () => {
  test('exposes stable check, smoke, and verify workflows', async () => {
    expect(await metaName(checkCommand)).toBe('check')
    expect(await metaName(smokeCommand)).toBe('smoke')
    expect(await metaName(verifyCommand)).toBe('verify')
    expect(await renderUsage(verifyCommand)).toContain('built-package smoke tests')
  })
})
