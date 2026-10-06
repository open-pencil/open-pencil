import * as v from 'valibot'

import type { ACPAgentDef } from '@open-pencil/core/constants'

import { HARNESS_INSTALL_TARGET } from '@/app/ai/harness/companion'
import { MCP_INSTALL_TARGET } from '@/app/automation/mcp/failure'
import { resolvePlatformCommand } from '@/app/tauri/command'

const lookupSchema = v.object({
  executables: v.record(v.string(), v.nullable(v.string())),
  /** Versions of OpenPencil's own companions, keyed by package name. */
  versions: v.record(v.string(), v.nullable(v.string())),
  searchPath: v.string()
})

export type AgentLookup = v.InferOutput<typeof lookupSchema>

export async function lookupAgents(): Promise<AgentLookup> {
  const { invoke } = await import('@tauri-apps/api/core')
  return v.parse(lookupSchema, await invoke<unknown>('agent_lookup'))
}

const INSTALL_TIMEOUT_MS = 120_000

export async function installAgentAdapter(agent: ACPAgentDef, searchPath: string): Promise<void> {
  if (!agent.adapterPackage) throw new Error('This agent does not need an adapter.')
  return installPackage(agent.adapterPackage, searchPath)
}

export async function installCanvasBridge(searchPath: string): Promise<void> {
  await installPackage(MCP_INSTALL_TARGET, searchPath)
}

export async function installHarnessCompanion(searchPath: string): Promise<void> {
  await installPackage(HARNESS_INSTALL_TARGET, searchPath)
}

/** The npm arguments that install a package globally; the desktop shell scope pins them. */
export function npmInstallArgs(packageName: string): string[] {
  // These are public packages; a user's private project registry may not mirror them.
  return ['install', '--global', packageName, '--registry=https://registry.npmjs.org']
}

async function installPackage(packageName: string, searchPath: string): Promise<void> {
  const { Command } = await import('@tauri-apps/plugin-shell')
  const resolved = resolvePlatformCommand('npm', npmInstallArgs(packageName))
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
