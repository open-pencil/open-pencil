import { describe, expect, test } from 'bun:test'
import { join } from 'node:path'

import harnessPackage from '../package.json'

describe('Pi dependencies', () => {
  test('pins pi-tui to the version pi-coding-agent uses', async () => {
    // pi-mcp-adapter imports pi-tui but declares it as an optional peer, and pi-coding-agent nests
    // its own copy, so the companion depends on pi-tui directly
    // (https://github.com/nicobailon/pi-mcp-adapter/issues/805). Upgrading @ai-sdk/harness-pi
    // moves pi-coding-agent; move this pin with it, or npm installs a second, mismatched pi-tui.
    const harnessPi = Bun.resolveSync('@ai-sdk/harness-pi', join(import.meta.dir, '..'))
    const agentManifest = Bun.resolveSync('@earendil-works/pi-coding-agent/package.json', harnessPi)
    const agent = (await Bun.file(agentManifest).json()) as {
      dependencies: Record<string, string>
    }
    const required = agent.dependencies['@earendil-works/pi-tui']
    const pinned = harnessPackage.dependencies['@earendil-works/pi-tui']
    expect(Bun.semver.satisfies(pinned, required)).toBe(true)
  })
})
