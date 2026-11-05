import { invoke } from '@tauri-apps/api/core'
import { Command } from '@tauri-apps/plugin-shell'
import * as v from 'valibot'

import type { ACPAgentDef } from '@open-pencil/core/constants'

import { HARNESS_INSTALL_TARGET } from '@/app/ai/agents/pi/companion'
import { MCP_INSTALL_TARGET } from '@/app/automation/mcp/failure'
import { resolvePlatformCommand } from '@/app/tauri/command'

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

const INSTALL_TIMEOUT_MS = 120_000

export async function installAgentAdapter(agent: ACPAgentDef, searchPath: string): Promise<void> {
  if (!agent.adapterPackage) throw new Error('This agent does not need an adapter.')
  return installPackage(agent.adapterPackage, searchPath)
}

export async function installCanvasBridge(
  searchPath: string,
  manager: PackageManager = 'npm'
): Promise<void> {
  await installPackage(MCP_INSTALL_TARGET, searchPath, manager)
}

export async function installHarnessCompanion(
  searchPath: string,
  manager: PackageManager = 'npm'
): Promise<void> {
  await installPackage(HARNESS_INSTALL_TARGET, searchPath, manager)
}

// These are public packages; a user's private project registry may not mirror them.
const PUBLIC_REGISTRY = '--registry=https://registry.npmjs.org'

/** The npm arguments that install a package globally; the desktop shell scope pins them. */
export function npmInstallArgs(packageName: string): string[] {
  return ['install', '--global', packageName, PUBLIC_REGISTRY]
}

/** The Bun arguments that install a package globally; the desktop shell scope pins them. */
export function bunInstallArgs(packageName: string): string[] {
  return ['add', '--global', packageName, PUBLIC_REGISTRY]
}

async function installPackage(
  packageName: string,
  searchPath: string,
  manager: PackageManager = 'npm'
): Promise<void> {
  const resolved = resolvePlatformCommand(
    manager,
    manager === 'bun' ? bunInstallArgs(packageName) : npmInstallArgs(packageName)
  )
  const command = Command.create(resolved.command, resolved.args, {
    env: { PATH: searchPath }
  })
  let child: Awaited<ReturnType<typeof command.spawn>> | undefined
  let timer: ReturnType<typeof setTimeout> | undefined
  let closed = false
  let finished = false
  async function killIfRunning() {
    if (!closed) await child?.kill().catch(() => undefined)
  }
  try {
    await new Promise<void>((resolve, reject) => {
      command.on('close', ({ code }) => {
        closed = true
        if (code === 0) resolve()
        else reject(new Error('Adapter installation failed.'))
      })
      command.on('error', () => reject(new Error('Adapter installation failed.')))
      timer = setTimeout(() => {
        reject(new Error('Adapter installation timed out.'))
      }, INSTALL_TIMEOUT_MS)
      void command.spawn().then((spawned) => {
        child = spawned
        if (finished) void killIfRunning()
        return undefined
      }, reject)
    })
  } finally {
    finished = true
    clearTimeout(timer)
    await killIfRunning()
  }
}
