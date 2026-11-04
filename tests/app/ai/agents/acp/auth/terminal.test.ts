import { afterEach, describe, expect, test } from 'bun:test'

import { ACP_AGENTS } from '@open-pencil/core/constants'

import {
  findSignInURL,
  startTerminalSignIn,
  stripTerminalCodes
} from '@/app/ai/agents/acp/auth/terminal'

import { expectDefined } from '#tests/helpers/assert'
import { clearTauriMocks, mockTauriIPC } from '#tests/helpers/tauri/mocks'

afterEach(clearTauriMocks)

const claude = expectDefined(
  ACP_AGENTS.find((agent) => agent.id === 'claude-code'),
  'Claude Code'
)
const LOGIN_ARGS = ['--cli', 'auth', 'login', '--claudeai']
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

type ShellEvent = { event: string; payload: unknown }

/** Mocks the shell plugin and returns what the login was started with and sent. */
async function mockLogin() {
  const calls: { cmd: string; args: unknown }[] = []
  let emit: (event: ShellEvent) => void = () => undefined
  await mockTauriIPC((cmd, args) => {
    calls.push({ cmd, args })
    if (cmd === 'plugin:shell|spawn') {
      emit = (args as { onEvent: { onmessage: (event: ShellEvent) => void } }).onEvent.onmessage
      return 7
    }
    return null
  })
  return { calls, emit: (event: ShellEvent) => emit(event) }
}

describe('startTerminalSignIn', () => {
  test('runs the agent under its sign-in scope entry and reports the page it prints', async () => {
    const shell = await mockLogin()
    const urls: string[] = []
    const login = await startTerminalSignIn(claude, LOGIN_ARGS, (url) => urls.push(url))
    expect(shell.calls[0]?.args).toMatchObject({
      program: 'claude-agent-acp-sign-in',
      args: LOGIN_ARGS
    })
    shell.emit({ event: 'Stdout', payload: 'Opening browser to sign in…' })
    shell.emit({ event: 'Stdout', payload: `If the browser didn't open, visit: ${PAGE}` })
    shell.emit({ event: 'Stdout', payload: `Again: ${PAGE}&other` })
    await login.submitCode(' code-123 ')
    shell.emit({ event: 'Terminated', payload: { code: 0, signal: null } })
    await login.done
    expect(urls).toEqual([PAGE])
    expect(shell.calls.find((call) => call.cmd === 'plugin:shell|stdin_write')?.args).toEqual({
      pid: 7,
      buffer: 'code-123\n'
    })
  })

  test('fails when the login exits without signing in', async () => {
    const shell = await mockLogin()
    const login = await startTerminalSignIn(claude, LOGIN_ARGS, () => undefined)
    shell.emit({ event: 'Terminated', payload: { code: 1, signal: null } })
    await expect(login.done).rejects.toThrow('Sign-in did not finish.')
  })

  test('stops the login when cancelled', async () => {
    const shell = await mockLogin()
    const login = await startTerminalSignIn(claude, LOGIN_ARGS, () => undefined)
    await login.cancel()
    await expect(login.done).rejects.toThrow('Sign-in was cancelled.')
    expect(shell.calls.map((call) => call.cmd)).toEqual(['plugin:shell|spawn', 'plugin:shell|kill'])
  })
})
