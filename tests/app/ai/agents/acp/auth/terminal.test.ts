import { afterEach, describe, expect, test } from 'bun:test'

import { ACP_AGENTS } from '@open-pencil/core/constants'
import { expectDefined } from '@open-pencil/test-support/assert'

import {
  findSignInURL,
  startTerminalSignIn,
  stripTerminalCodes
} from '@/app/ai/agents/acp/auth/terminal'

import { clearTauriMocks, mockHost } from '#tests/helpers/tauri/mocks'

afterEach(clearTauriMocks)

const claude = expectDefined(
  ACP_AGENTS.find((agent) => agent.id === 'claude-code'),
  'Claude Code'
)
const PAGE = 'https://claude.com/cai/oauth/authorize?code=true&state=abc'

describe('login output', () => {
  test('drops terminal hyperlinks and colours', () => {
    expect(
      stripTerminalCodes(`\u001B[1mvisit:\u001B[0m \u001B]8;;${PAGE}\u0007${PAGE}\u001B]8;;\u0007`)
    ).toBe(`visit: ${PAGE}`)
  })

  test('finds the sign-in page in a line, if any', () => {
    expect(
      findSignInURL(
        `If the browser didn't open, visit: \u001B]8;;${PAGE}\u0007${PAGE}\u001B]8;;\u0007`
      )
    ).toBe(PAGE)
    expect(findSignInURL('Opening browser to sign in…')).toBeNull()
  })
})

/** Mocks the desktop app's host commands, with Claude Code's adapter installed. */
function mockLogin() {
  return mockHost({
    otherwise: (cmd) =>
      cmd === 'agent_lookup'
        ? {
            executables: { 'claude-agent-acp': '/lookup/bin/claude-agent-acp' },
            versions: {},
            searchPath: '/lookup/bin'
          }
        : null
  })
}

describe('startTerminalSignIn', () => {
  test("starts the agent's sign-in and reports the first page it prints", async () => {
    const host = await mockLogin()
    const urls: string[] = []
    const login = await startTerminalSignIn(claude, (url) => urls.push(url))
    expect(host.started[0]?.program).toEqual({ kind: 'signIn', agent: 'claude-code' })
    host.emit({ type: 'stdout', data: 'Opening browser to sign in…\n' })
    host.emit({ type: 'stdout', data: `If the browser didn't open, visit: ${PAGE.slice(0, 20)}` })
    host.emit({ type: 'stdout', data: `${PAGE.slice(20)}\nAgain: ${PAGE}&other\n` })
    host.emit({ type: 'close', code: 0, signal: null })
    await login.done
    expect(urls).toEqual([PAGE])
  })

  test('sends a pasted code to the login as a line', async () => {
    const host = await mockLogin()
    const login = await startTerminalSignIn(claude, () => undefined)
    await login.submitCode(' code-123 ')
    expect(host.calls.find((call) => call.cmd === 'host_write')?.args).toEqual({
      id: 1,
      data: 'code-123\n'
    })
  })

  test('fails when the login exits without signing in', async () => {
    const host = await mockLogin()
    const login = await startTerminalSignIn(claude, () => undefined)
    host.emit({ type: 'close', code: 1, signal: null })
    await expect(login.done).rejects.toThrow('Sign-in did not finish.')
  })

  test('stops the login when cancelled', async () => {
    const host = await mockLogin()
    const login = await startTerminalSignIn(claude, () => undefined)
    await login.cancel()
    await expect(login.done).rejects.toThrow('Sign-in was cancelled.')
    expect(
      host.calls.filter((call) => call.cmd.startsWith('host_')).map((call) => call.cmd)
    ).toEqual(['host_start', 'host_kill'])
  })
})
