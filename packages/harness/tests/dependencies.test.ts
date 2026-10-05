import { describe, expect, test } from 'bun:test'
import { join } from 'node:path'

import harnessPackage from '../package.json'

function piTuiRange(manifest: unknown): string | undefined {
  if (typeof manifest !== 'object' || manifest === null || !('dependencies' in manifest)) {
    return undefined
  }
  const dependencies = manifest.dependencies
  if (typeof dependencies !== 'object' || dependencies === null) return undefined
  const range: unknown = Reflect.get(dependencies, '@earendil-works/pi-tui')
  return typeof range === 'string' ? range : undefined
}

describe('Pi dependencies', () => {
  test('pins pi-tui to the version pi-coding-agent uses', async () => {
    // pi-mcp-adapter imports pi-tui but declares it as an optional peer, and pi-coding-agent nests
    // its own copy, so the companion depends on pi-tui directly
    // (https://github.com/nicobailon/pi-mcp-adapter/issues/805). Upgrading @ai-sdk/harness-pi
    // moves pi-coding-agent; move this pin with it, or npm installs a second, mismatched pi-tui.
    const harnessPi = Bun.resolveSync('@ai-sdk/harness-pi', join(import.meta.dir, '..'))
    const agentManifest = Bun.resolveSync('@earendil-works/pi-coding-agent/package.json', harnessPi)
    const manifest: unknown = await Bun.file(agentManifest).json()
    const required = piTuiRange(manifest)
    const pinned = harnessPackage.dependencies['@earendil-works/pi-tui']
    expect(required).toBeString()
    expect(Bun.semver.satisfies(pinned, required ?? '')).toBe(true)
  })
})
