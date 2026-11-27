import { afterEach, expect, test } from 'bun:test'

import { ACP_AGENTS } from '@open-pencil/core/constants'
import { expectDefined } from '@open-pencil/test-support/assert'

import {
  installAgentAdapter,
  installCanvasBridge,
  installHarnessCompanion,
  lookupAgents
} from '@/app/ai/agents/setup/native'
import { APP_VERSION } from '@/app/runtime/version'

import { clearTauriMocks, mockHost, mockTauriIPC } from '#tests/helpers/tauri/mocks'

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

const codex = expectDefined(
  ACP_AGENTS.find((agent) => agent.id === 'codex'),
  'Codex'
)

test.each([0, 1])('installs the selected adapter and handles exit code %i', async (code) => {
  const host = await mockHost({
    onStart: (start) => queueMicrotask(() => start.emit({ type: 'close', code, signal: null }))
  })
  const installation = installAgentAdapter(codex)
  if (code === 0) await installation
  else await expect(installation).rejects.toThrow('Adapter installation failed.')
  expect(host.started.map((start) => start.program)).toEqual([
    { kind: 'install', manager: 'npm', package: { kind: 'adapter', agent: 'codex' } }
  ])
})

test("installs the companions at this app's version with the chosen manager", async () => {
  const host = await mockHost({
    onStart: (start) => queueMicrotask(() => start.emit({ type: 'close', code: 0, signal: null }))
  })
  await installCanvasBridge('bun')
  await installHarnessCompanion()
  expect(host.started.map((start) => start.program)).toEqual([
    { kind: 'install', manager: 'bun', package: { kind: 'mcp', version: APP_VERSION } },
    { kind: 'install', manager: 'npm', package: { kind: 'harness', version: APP_VERSION } }
  ])
})

test('rejects native agents before attempting an adapter install', async () => {
  const gemini = expectDefined(
    ACP_AGENTS.find((agent) => agent.id === 'gemini-cli'),
    'Gemini CLI'
  )
  await expect(installAgentAdapter(gemini)).rejects.toThrow('This agent does not need an adapter.')
})

test('fails the install when the desktop app refuses to start it', async () => {
  await mockHost({
    onStart: () => {
      throw new Error('refused')
    }
  })
  await expect(installAgentAdapter(codex)).rejects.toThrow('Adapter installation failed.')
})
