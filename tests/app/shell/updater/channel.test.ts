import { describe, expect, test } from 'bun:test'

import { buildUpdateChannel, resolveUpdateChannel } from '@/app/shell/updater/channel'

describe('update channels', () => {
  test('reads a build’s channel from its version', () => {
    expect(buildUpdateChannel('0.17.0')).toBe('stable')
    expect(buildUpdateChannel('0.17.0-beta.5')).toBe('stable')
    expect(buildUpdateChannel('0.17.0-nightly.20261116')).toBe('nightly')
    expect(buildUpdateChannel('0.17.0-nightly.20261116.2')).toBe('nightly')
    expect(buildUpdateChannel('0.17.0-nightlyish.1')).toBe('stable')
  })

  test('follows the installed build until a channel is chosen', () => {
    expect(resolveUpdateChannel('build', '0.17.0-nightly.20261116')).toBe('nightly')
    expect(resolveUpdateChannel('build', '0.17.0')).toBe('stable')
    expect(resolveUpdateChannel('stable', '0.17.0-nightly.20261116')).toBe('stable')
    expect(resolveUpdateChannel('nightly', '0.17.0')).toBe('nightly')
  })
})
