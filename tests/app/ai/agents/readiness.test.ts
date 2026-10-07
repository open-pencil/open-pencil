import { describe, expect, test } from 'bun:test'

import { createAgentDiscovery } from '@/app/ai/agents/discovery'
import type { AgentLookup } from '@/app/ai/agents/native'
import { AgentSetupError, assertAgentReady } from '@/app/ai/agents/readiness'

function discovery(lookup: () => Promise<AgentLookup>, enabled = true) {
  return createAgentDiscovery({ enabled, lookup, install: async () => undefined })
}

function installed(versions: AgentLookup['versions'] = {}, ...commands: string[]) {
  return async (): Promise<AgentLookup> => ({
    searchPath: '/test/bin',
    versions,
    executables: Object.fromEntries(commands.map((command) => [command, `/test/bin/${command}`]))
  })
}

async function problem(agent: 'acp' | 'pi', lookup: () => Promise<AgentLookup>) {
  try {
    await assertAgentReady(agent, discovery(lookup))
    return null
  } catch (error) {
    if (error instanceof AgentSetupError) return error.problem
    throw error
  }
}

describe('assertAgentReady', () => {
  test('lets a chat start when its companions match the app', async () => {
    const lookup = installed(
      { '@open-pencil/harness': '0.0.2', '@open-pencil/mcp': '0.0.2' },
      'openpencil-harness',
      'openpencil-mcp-http'
    )
    expect(await problem('pi', lookup)).toBeNull()
    expect(await problem('acp', lookup)).toBeNull()
  })

  test('names the missing or mismatched companion', async () => {
    expect(await problem('pi', installed({}, 'openpencil-mcp-http'))).toBe('companion-missing')
    expect(
      await problem('pi', installed({ '@open-pencil/harness': '0.12.0' }, 'openpencil-harness'))
    ).toBe('companion-outdated')
    expect(
      await problem('acp', installed({ '@open-pencil/mcp': '0.12.0' }, 'openpencil-mcp-http'))
    ).toBe('mcp-outdated')
  })

  test('only Pi needs the Harness companion', async () => {
    expect(await problem('acp', installed())).toBeNull()
  })

  test('does not block a chat when the computer cannot be checked', async () => {
    expect(
      await problem('pi', async () => {
        throw new Error('lookup failed')
      })
    ).toBeNull()
    await assertAgentReady('pi', discovery(installed(), false))
  })
})
