import { Channel } from '@tauri-apps/api/core'
import * as v from 'valibot'

import type { HostEvent } from '@/app/tauri/host'

export function installTauriMockWindow() {
  Object.assign(globalThis, { window: globalThis })
}

export async function mockTauriIPC(
  handler: (cmd: string, args: unknown, options?: unknown) => unknown
) {
  installTauriMockWindow()
  const { mockIPC } = await import('@tauri-apps/api/mocks')
  mockIPC(handler)
  const windowLike = window as typeof window & {
    __TAURI_INTERNALS__: {
      invoke: (cmd: string, args: unknown, options?: unknown) => Promise<unknown>
    }
  }
  windowLike.__TAURI_INTERNALS__.invoke = async (cmd, args, options) => handler(cmd, args, options)
}

export async function clearTauriMocks() {
  if (!('window' in globalThis)) return
  const { clearMocks } = await import('@tauri-apps/api/mocks')
  clearMocks()
  Reflect.deleteProperty(window, '__TAURI_INTERNALS__')
  Reflect.deleteProperty(window, '__TAURI_EVENT_PLUGIN_INTERNALS__')
  Reflect.deleteProperty(globalThis, 'window')
}

/** A program a mocked `host_start` call started: what the editor asked for, and its events. */
export interface HostStart {
  program: unknown
  /** Sends the editor an event of this program, as the desktop app does over its channel. */
  emit: (event: HostEvent) => void
}

const hostStartSchema = v.object({ program: v.unknown(), events: v.instance(Channel) })

/** Reads the arguments of a mocked `host_start` call. */
export function hostStart(args: unknown): HostStart {
  const { program, events } = v.parse(hostStartSchema, args)
  return { program, emit: (event) => events.onmessage(event) }
}

export interface MockHost {
  /** The programs the editor started, in order; each one's id is its position plus one. */
  started: HostStart[]
  /** Every command the editor invoked, with its arguments. */
  calls: { cmd: string; args: unknown }[]
  /** Sends an event of the program started last. */
  emit: (event: HostEvent) => void
}

/**
 * Mocks the desktop app's `host_start`, `host_write`, and `host_kill` commands. `onStart` sees
 * each program as it starts and may throw to refuse it; other commands go to `otherwise`.
 */
export async function mockHost(
  options: {
    onStart?: (start: HostStart) => void
    otherwise?: (cmd: string, args: unknown) => unknown
  } = {}
): Promise<MockHost> {
  const host: MockHost = {
    started: [],
    calls: [],
    emit: (event) => host.started.at(-1)?.emit(event)
  }
  await mockTauriIPC((cmd, args) => {
    host.calls.push({ cmd, args })
    if (cmd === 'host_start') {
      const start = hostStart(args)
      options.onStart?.(start)
      host.started.push(start)
      return host.started.length
    }
    if (cmd === 'host_write' || cmd === 'host_kill') return null
    return options.otherwise?.(cmd, args) ?? null
  })
  return host
}
