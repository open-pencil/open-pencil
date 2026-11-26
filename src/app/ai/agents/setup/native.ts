import { invoke } from '@tauri-apps/api/core'
import * as v from 'valibot'

import type { ACPAgentDef } from '@open-pencil/core/constants'
import { createDeferred } from '@open-pencil/std/async'
import { MINUTE_MS } from '@open-pencil/std/timing'

import { APP_VERSION } from '@/app/runtime/version'
import {
  startHostProgram,
  type HostChild,
  type HostClose,
  type HostPackage
} from '@/app/tauri/host'

import type { PackageManager } from './companions'

const lookupSchema = v.object({
  executables: v.record(v.string(), v.nullable(v.string())),
  /** Versions of OpenPencil's own companions, keyed by package name. */
  versions: v.record(v.string(), v.nullable(v.string())),
  /** Whether this user can write npm's global folder; null without npm. */
  npmGlobalWritable: v.nullish(v.boolean()),
  searchPath: v.string()
})

export type AgentLookup = v.InferOutput<typeof lookupSchema>

export async function lookupAgents(): Promise<AgentLookup> {
  return v.parse(lookupSchema, await invoke<unknown>('agent_lookup'))
}

/** The folder coding agents start in, which the desktop shell creates in the app's data. */
export async function agentWorkspace(): Promise<string> {
  return v.parse(v.string(), await invoke<unknown>('agent_workspace'))
}

const INSTALL_TIMEOUT_MS = 2 * MINUTE_MS

export async function installAgentAdapter(agent: ACPAgentDef): Promise<void> {
  if (!agent.adapterPackage) throw new Error('This agent does not need an adapter.')
  return installPackage({ kind: 'adapter', agent: agent.id })
}

export async function installCanvasBridge(manager: PackageManager = 'npm'): Promise<void> {
  await installPackage({ kind: 'mcp', version: APP_VERSION }, manager)
}

export async function installHarnessCompanion(manager: PackageManager = 'npm'): Promise<void> {
  await installPackage({ kind: 'harness', version: APP_VERSION }, manager)
}

/**
 * Installs a package globally with npm or Bun. The desktop app holds the command line, from the
 * public registry, since a user's private project registry may not mirror these packages.
 */
async function installPackage(pkg: HostPackage, manager: PackageManager = 'npm'): Promise<void> {
  const closed = createDeferred<HostClose>()
  let child: HostChild | undefined
  let timer: ReturnType<typeof setTimeout> | undefined
  let finished = false
  try {
    child = await startHostProgram(
      { kind: 'install', manager, package: pkg },
      { onClose: (event) => closed.resolve(event) }
    )
    const timedOut = new Promise<never>((_, reject) => {
      timer = setTimeout(
        () => reject(new Error('Adapter installation timed out.')),
        INSTALL_TIMEOUT_MS
      )
    })
    const { code } = await Promise.race([closed.promise, timedOut])
    finished = true
    if (code !== 0) throw new Error('Adapter installation failed.')
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('Adapter installation')) throw error
    throw new Error('Adapter installation failed.', { cause: error })
  } finally {
    clearTimeout(timer)
    if (!finished) await child?.kill().catch(() => undefined)
  }
}
