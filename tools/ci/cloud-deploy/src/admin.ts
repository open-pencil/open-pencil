import { CommandError, runCommand } from '@open-pencil/package-artifacts-tools'
import { resolveWorkspaceRoot } from '@open-pencil/package-artifacts-tools/workspace'

import { CLOUD_TARGETS, type CloudTarget } from './ref'

/** Where each official deployment's database lives in Neon, and the role that owns its schema. */
export const NEON_DATABASES: Record<
  CloudTarget,
  { project: string; branch?: string; role: string }
> = {
  staging: {
    project: 'lucky-star-94360358',
    branch: 'staging',
    role: 'openpencil_staging_migrator'
  },
  production: { project: 'soft-fog-46775196', role: 'openpencil_production_migrator' }
}

const DATABASE = 'openpencil_cloud'
const OPERATIONS = ['approve', 'grant', 'request'] as const

/** The `neonctl` arguments that print a target's connection string. */
export function connectionStringArgs(target: CloudTarget): string[] {
  const { project, branch, role } = NEON_DATABASES[target]
  return [
    'connection-string',
    ...(branch ? [branch] : []),
    '--project-id',
    project,
    '--database-name',
    DATABASE,
    '--role-name',
    role
  ]
}

/**
 * The address with TLS verified in full: Neon's asks for `sslmode=require`, which `pg` already
 * treats as `verify-full` while warning on every run that the meaning will change.
 */
export function verifiedAddress(address: string): string {
  const url = new URL(address)
  url.searchParams.set('sslmode', 'verify-full')
  return url.href
}

function isTarget(value: string): value is CloudTarget {
  return (CLOUD_TARGETS as readonly string[]).includes(value)
}

/**
 * Runs Cloud's admin command against an official deployment, with the database address from
 * `neonctl`. The address only ever travels in the child's environment: a failure is reported by
 * name, since the command's error carries that environment and Bun prints it.
 */
export async function runOfficialAdmin(
  args: string[],
  cwd: string,
  execute = runCommand
): Promise<void> {
  const [target = '', operation = '', email, ...rest] = args
  if (!isTarget(target) || !(OPERATIONS as readonly string[]).includes(operation) || !email) {
    throw new Error(
      `Usage: cloud:admin <${CLOUD_TARGETS.join('|')}> <${OPERATIONS.join('|')}> <email> [name]`
    )
  }
  let connectionString: string
  try {
    connectionString = verifiedAddress(
      (await execute({ command: 'neonctl', args: connectionStringArgs(target), cwd })).stdout.trim()
    )
  } catch (error) {
    const detail = error instanceof CommandError ? error.stderr.trim() : String(error)
    throw new Error(`neonctl could not give ${target}'s database address: ${detail}`)
  }
  try {
    await execute({
      command: 'bun',
      args: ['--filter', '@open-pencil/cloud', 'admin', operation, email, ...rest],
      cwd,
      env: { ...process.env, DATABASE_URL: connectionString },
      output: 'inherit'
    })
  } catch {
    throw new Error(`The admin command failed on ${target}; its output is above`)
  }
}

if (import.meta.main) {
  try {
    await runOfficialAdmin(process.argv.slice(2), await resolveWorkspaceRoot(process.cwd()))
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error))
    process.exit(1)
  }
}
