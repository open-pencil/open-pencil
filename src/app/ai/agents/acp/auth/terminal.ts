import type { ACPAgentDef } from '@open-pencil/core/constants'
import { createDeferred } from '@open-pencil/std/async'
import { MINUTE_MS } from '@open-pencil/std/timing'

import { resolveSpawnTarget } from '@/app/ai/agents/setup/discovery'
import { startHostProgram } from '@/app/tauri/host'

/** Long enough to sign in from a fresh browser, short enough not to leave a login waiting. */
const SIGN_IN_TIMEOUT_MS = 5 * MINUTE_MS

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
  onURL: (url: string) => void
): Promise<TerminalSignIn> {
  // Fails with the agent's own setup message when it is not installed.
  await resolveSpawnTarget(agent)
  const finished = createDeferred<undefined>()
  let closed = false
  let urlSeen = false
  let pending = ''
  const child = await startHostProgram(
    { kind: 'signIn', agent: agent.id },
    {
      onStdout: (data) => {
        if (urlSeen) return
        pending += data
        const lines = pending.split('\n')
        pending = lines.pop() ?? ''
        const url = lines.map(findSignInURL).find((found) => found !== null)
        if (!url) return
        urlSeen = true
        onURL(url)
      },
      onClose: ({ code }) => {
        closed = true
        if (code === 0) finished.resolve(undefined)
        else finished.reject(new Error('Sign-in did not finish.'))
      }
    }
  ).catch((error: unknown) => {
    throw new Error('Sign-in could not start.', { cause: error })
  })
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
