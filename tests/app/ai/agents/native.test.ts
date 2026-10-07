import { afterEach, expect, test } from 'bun:test'

import type { Channel } from '@tauri-apps/api/core'

import { ACP_AGENTS } from '@open-pencil/core/constants'

import { installAgentAdapter, lookupAgents } from '@/app/ai/agents/native'
import { createDeferred } from '@/app/runtime/deferred'

import { expectDefined } from '#tests/helpers/assert'
import { clearTauriMocks, mockTauriIPC } from '#tests/helpers/tauri/mocks'

afterEach(clearTauriMocks)

test('validates native discovery responses', async () => {
  await mockTauriIPC((command) => {
    expect(command).toBe('agent_lookup')
    return {
      executables: { claude: '/bin/claude', npm: null },
      versions: { '@open-pencil/mcp': '0.15.1' },
      searchPath: '/bin'
    }
  })
  const lookup = await lookupAgents()
  expect(lookup.executables.claude).toBe('/bin/claude')
  expect(lookup.versions['@open-pencil/mcp']).toBe('0.15.1')
  await mockTauriIPC(() => ({ executables: { claude: true }, versions: {}, searchPath: '/bin' }))
  await expect(lookupAgents()).rejects.toThrow()
})

test.each([0, 1])('installs the selected adapter and handles exit code %i', async (code) => {
  const commands: string[] = []
  await mockTauriIPC((command, args) => {
    commands.push(command)
    expect(command).toBe('plugin:shell|spawn')
    const spawn = args as {
      program: string
      args: string[]
      options: { env: { PATH: string } }
      onEvent: Channel
    }
    expect(spawn.program).toBe('npm')
    expect(spawn.args).toEqual([
      'install',
      '--global',
      '@agentclientprotocol/codex-acp',
      '--registry=https://registry.npmjs.org'
    ])
    expect(spawn.options.env.PATH).toBe('/agents/bin')
    queueMicrotask(() =>
      spawn.onEvent.onmessage({ event: 'Terminated', payload: { code, signal: null } })
    )
    return 42
  })
  const codex = expectDefined(
    ACP_AGENTS.find((agent) => agent.id === 'codex'),
    'Codex'
  )
  const installation = installAgentAdapter(codex, '/agents/bin')
  if (code === 0) await installation
  else await expect(installation).rejects.toThrow('Adapter installation failed.')
  expect(commands).toEqual(['plugin:shell|spawn'])
})

test('rejects native agents before attempting an adapter install', async () => {
  const gemini = expectDefined(
    ACP_AGENTS.find((agent) => agent.id === 'gemini-cli'),
    'Gemini CLI'
  )
  await expect(installAgentAdapter(gemini, '/bin')).rejects.toThrow(
    'This agent does not need an adapter.'
  )
})

test('cleans up an installer that reports an error before its process handle arrives', async () => {
  const spawned = createDeferred<number>()
  const killed = createDeferred<undefined>()
  await mockTauriIPC((command, args) => {
    if (command === 'plugin:shell|kill') {
      expect(args).toMatchObject({ pid: 42 })
      killed.resolve(undefined)
      return
    }
    expect(command).toBe('plugin:shell|spawn')
    const { onEvent } = args as { onEvent: Channel }
    queueMicrotask(() => onEvent.onmessage({ event: 'Error', payload: 'private npm details' }))
    return spawned.promise
  })
  const codex = expectDefined(
    ACP_AGENTS.find((agent) => agent.id === 'codex'),
    'Codex'
  )
  await expect(installAgentAdapter(codex, '/bin')).rejects.toThrow('Adapter installation failed.')
  spawned.resolve(42)
  await killed.promise
})
