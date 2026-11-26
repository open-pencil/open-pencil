import { Channel, invoke } from '@tauri-apps/api/core'
import * as v from 'valibot'

import type { ACPAgentID } from '@open-pencil/core/constants'

/**
 * A package the desktop app installs globally: an agent's ACP adapter, or one of OpenPencil's
 * companions pinned to a release version.
 */
export type HostPackage =
  | { kind: 'adapter'; agent: ACPAgentID }
  | { kind: 'mcp'; version: string }
  | { kind: 'harness'; version: string }

/**
 * A program the desktop app starts for the editor. The app holds the table of what each one runs,
 * with which arguments, folder, and environment (`desktop/src/host/program.rs`); the editor only
 * picks one and the few values it may choose.
 */
export type HostProgram =
  | { kind: 'agent'; agent: ACPAgentID; refusesTools?: boolean }
  | { kind: 'signIn'; agent: ACPAgentID }
  | { kind: 'install'; manager: 'npm' | 'bun'; package: HostPackage }
  | {
      kind: 'mcpServer'
      /** MCP clients may connect without a token; the desktop app makes the tokens itself. */
      tokenlessClients: boolean
      root: string
      disabledTools: string[]
      scope: 'document' | 'selection'
    }
  | { kind: 'harness'; apiKey?: string; agentDir?: string }

const hostEventSchema = v.variant('type', [
  v.object({ type: v.literal('stdout'), data: v.string() }),
  v.object({ type: v.literal('stderr'), data: v.string() }),
  v.object({
    type: v.literal('close'),
    code: v.nullable(v.number()),
    signal: v.nullable(v.number())
  }),
  v.object({ type: v.literal('permission'), title: v.string(), waiting: v.boolean() })
])

export type HostEvent = v.InferOutput<typeof hostEventSchema>
export type HostClose = Extract<HostEvent, { type: 'close' }>

export interface HostHandlers {
  /** What it wrote; a JSON-lines program's lines arrive whole, each ending in `\n`. */
  onStdout?: (data: string) => void
  onStderr?: (data: string) => void
  onClose?: (event: HostClose) => void
  /**
   * An agent waits on the person in the permission window, which the desktop app opens and
   * answers, or no longer does.
   */
  onPermission?: (event: { title: string; waiting: boolean }) => void
}

/** A program the desktop app runs for the editor. */
export interface HostChild {
  write(data: string): Promise<void>
  kill(): Promise<void>
}

/**
 * Asks the desktop app to start a program from its table. The app stops it when the editor's
 * page reloads or the app quits.
 */
export async function startHostProgram(
  program: HostProgram,
  handlers: HostHandlers = {}
): Promise<HostChild> {
  const events = new Channel<unknown>((message) => {
    const event = v.safeParse(hostEventSchema, message)
    if (!event.success) return
    const { output } = event
    if (output.type === 'stdout') handlers.onStdout?.(output.data)
    else if (output.type === 'stderr') handlers.onStderr?.(output.data)
    else if (output.type === 'close') handlers.onClose?.(output)
    else handlers.onPermission?.(output)
  })
  const id = v.parse(v.number(), await invoke<unknown>('host_start', { program, events }))
  return {
    write: (data) => invoke('host_write', { id, data }),
    kill: () => invoke('host_kill', { id })
  }
}
