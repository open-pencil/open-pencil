import { describe, expect, test } from 'bun:test'

import { globalInstallCommand, isOutdatedCompanion } from '@/app/ai/agents/companions'

describe('isOutdatedCompanion', () => {
  test('requires the app’s major and minor version', () => {
    expect(isOutdatedCompanion('0.15.0', '0.15.1')).toBe(false)
    expect(isOutdatedCompanion('0.12.0', '0.15.1')).toBe(true)
    expect(isOutdatedCompanion('1.15.1', '0.15.1')).toBe(true)
  })

  test('treats an installed companion without a version as outdated', () => {
    expect(isOutdatedCompanion(null, '0.15.1')).toBe(true)
  })
})

describe('globalInstallCommand', () => {
  test('uses the package manager that installed the program', () => {
    expect(globalInstallCommand('@open-pencil/mcp@0.15.1', '/Users/me/.bun/bin/x')).toBe(
      'bun add -g @open-pencil/mcp@0.15.1'
    )
    expect(globalInstallCommand('@open-pencil/mcp@0.15.1', 'C:\\Users\\me\\.bun\\bin\\x.exe')).toBe(
      'bun add -g @open-pencil/mcp@0.15.1'
    )
    expect(globalInstallCommand('@open-pencil/mcp@0.15.1', '/usr/local/bin/x')).toBe(
      'npm i -g @open-pencil/mcp@0.15.1'
    )
    expect(globalInstallCommand('@open-pencil/mcp@0.15.1')).toBe('npm i -g @open-pencil/mcp@0.15.1')
  })
})
