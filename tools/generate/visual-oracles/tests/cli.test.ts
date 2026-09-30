import { describe, expect, test } from 'bun:test'

import { renderUsage } from 'citty'

import compareCommand from '../src/commands/compare'

describe('visual oracle CLI', () => {
  test('groups node and document comparison under one command', async () => {
    const usage = await renderUsage(compareCommand)

    expect(usage).toContain('node')
    expect(usage).toContain('document')
  })
})
