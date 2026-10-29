import { describe, expect, test } from 'bun:test'

import {
  companionPackageManager,
  globalInstallCommand,
  isOutdatedCompanion
} from '@/app/ai/agents/setup/companions'

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

describe('companionPackageManager', () => {
  test('recognises a companion Bun installed on any platform', () => {
    expect(companionPackageManager('/Users/me/.bun/bin/x')).toBe('bun')
    expect(companionPackageManager('C:\\Users\\me\\.bun\\bin\\x.exe')).toBe('bun')
    expect(companionPackageManager('/usr/local/bin/x')).toBe('npm')
    expect(companionPackageManager(null)).toBe('npm')
  })
})

describe('globalInstallCommand', () => {
  test('names the package manager, and sudo only where npm needs administrator rights', () => {
    const target = '@open-pencil/mcp@0.15.1'
    expect(globalInstallCommand(target, 'bun', { admin: true })).toBe(`bun add -g ${target}`)
    expect(globalInstallCommand(target, 'npm')).toBe(`npm i -g ${target}`)
    expect(globalInstallCommand(target, 'npm', { admin: true })).toBe(`sudo npm i -g ${target}`)
    // Windows has no sudo, and its default npm folder belongs to the user.
    expect(globalInstallCommand(target, 'npm', { admin: true, windows: true })).toBe(
      `npm i -g ${target}`
    )
  })
})
