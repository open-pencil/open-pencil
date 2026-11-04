import { Command } from '@tauri-apps/plugin-shell'

import type { ACPAgentDef } from '@open-pencil/core/constants'

import { createDeferred } from '@/app/runtime/deferred'
import { resolveScopedCommand } from '@/app/tauri/command'

/** Long enough to sign in from a fresh browser, short enough not to leave a login waiting. */
const SIGN_IN_TIMEOUT_MS = 5 * 60_000

/**
 * Terminal hyperlinks (OSC 8) and colour or cursor codes, which the login prints for a
 * terminal and which the app shows as plain text.
 */
// eslint-disable-next-line no-control-regex -- Escape sequences are what it removes.
const TERMINAL_CODES = /\u001B\]8;[^\u0007\u001B]*(?:\u0007|\u001B\\)|\u001B\[[0-9;?]*[A-Za-z]/g

export function stripTerminalCodes(text: string): string {
  return text.replace(TERMINAL_CODES, '')
}

/** The first web address in a line of the login's output. */
export function findSignInURL(line: string): string | null {
  return /https:\/\/\S+/.exec(stripTerminalCodes(line))?.[0] ?? null
}

/** The scope entry that pins an agent's sign-in arguments in the desktop shell scope. */
export function signInScope(agent: ACPAgentDef): string {
  return `${agent.command}-sign-in`
}

export interface TerminalSignIn {
  /** Settles when the login exits: resolved when it signed in, rejected otherwise. */
  done: Promise<void>
  /** Sends the code the sign-in page shows, for when the browser cannot return to the login. */
  submitCode: (code: string) => Promise<void>
  cancel: () => Promise<void>
}

/**
 * Runs an agent's terminal auth method without a terminal: the login opens the browser itself,
 * prints a page to open by hand, and reads a pasted code from stdin if the browser cannot
 * hand the sign-in back.
 */
export async function startTerminalSignIn(
  agent: ACPAgentDef,
  args: string[],
  onURL: (url: string) => void
): Promise<TerminalSignIn> {
  const resolved = resolveScopedCommand(signInScope(agent), agent.command, args)
  const command = Command.create(resolved.command, resolved.args)
  const finished = createDeferred<undefined>()
  let closed = false
  let urlSeen = false
  command.stdout.on('data', (line: string) => {
    const url = urlSeen ? null : findSignInURL(line)
    if (!url) return
    urlSeen = true
    onURL(url)
  })
  command.on('close', ({ code }) => {
    closed = true
    if (code === 0) finished.resolve(undefined)
    else finished.reject(new Error('Sign-in did not finish.'))
  })
  command.on('error', () => finished.reject(new Error('Sign-in could not start.')))
  const child = await command.spawn()
  const timer = setTimeout(() => {
    finished.reject(new Error('Sign-in timed out.'))
    void stop()
  }, SIGN_IN_TIMEOUT_MS)
  async function stop() {
    if (!closed) await child.kill().catch(() => undefined)
  }
  const done = finished.promise.finally(() => clearTimeout(timer))
  // A caller that only cancels must not see an unhandled rejection.
  done.catch(() => undefined)
  return {
    done,
    submitCode: (code) => child.write(`${code.trim()}\n`),
    async cancel() {
      finished.reject(new Error('Sign-in was cancelled.'))
      await stop()
    }
  }
}
