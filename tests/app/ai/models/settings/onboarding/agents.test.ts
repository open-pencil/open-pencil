import { describe, expect, mock, test } from 'bun:test'

import { createAgentDiscovery } from '@/app/ai/agents/discovery'
import type { AgentLookup } from '@/app/ai/agents/native'
import { useOnboardingAgents } from '@/app/ai/models/settings/onboarding/agents'

function lookup(...commands: string[]): AgentLookup {
  return {
    searchPath: '/test/bin',
    versions: {},
    executables: Object.fromEntries(commands.map((command) => [command, `/test/bin/${command}`]))
  }
}

describe('useOnboardingAgents', () => {
  test('installs the Harness companion for Pi and reads Pi’s default model', async () => {
    let installed = false
    const installHarness = mock(async () => {
      installed = true
    })
    const discovery = createAgentDiscovery({
      enabled: true,
      lookup: async () => lookup('npm', ...(installed ? ['openpencil-harness'] : [])),
      install: async () => undefined,
      installHarness
    })
    const agents = useOnboardingAgents(discovery, async () => ({
      agentDir: '/home/test/.pi/agent',
      defaultModel: 'openai-codex/gpt-5.6',
      signedIn: true
    }))
    await agents.refreshAgents()
    expect(agents.piSetup('harness:pi')).toMatchObject({
      companion: false,
      npm: true,
      defaultModel: 'openai-codex/gpt-5.6'
    })
    await agents.installAgent('harness:pi')
    expect(installHarness).toHaveBeenCalledTimes(1)
    expect(agents.piSetup('harness:pi')?.companion).toBe(true)
    expect(agents.piSetup('acp:codex')).toBeUndefined()
  })
})
