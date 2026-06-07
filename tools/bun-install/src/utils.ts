import { delimiter, join } from 'node:path'

import type { PackageData, SpawnOpts } from './types.ts'

/** Logs an informational message to stdout. */
export function log(msg: string): void {
  console.log(msg)
}

/** Prints a fatal error to stderr and exits the process with code 1. */
export function die(msg: string): never {
  console.error(`\nFATAL: ${msg}`)
  process.exit(1)
}

/**
 * Spawns a command synchronously, inheriting stdio from the parent.
 * Returns the exit code (defaults to 1 if missing).
 */
export function runRaw(cmd: string, args: string[], opts?: SpawnOpts): number {
  const proc = Bun.spawnSync([cmd, ...args], {
    cwd: opts?.cwd,
    stdio: ['inherit', 'inherit', 'inherit'],
    env: process.env as Record<string, string>
  })
  return proc.exitCode ?? 1
}

/**
 * Spawns a command synchronously, inheriting stdio.
 * Throws (via {@link die}) if the command exits non-zero.
 */
export function run(cmd: string, args: string[], opts?: SpawnOpts): void {
  const code = runRaw(cmd, args, opts)
  if (code !== 0) {
    die(`Command failed (exit ${code}): ${cmd} ${args.join(' ')}`)
  }
}

/**
 * Spawns a command synchronously, inheriting stdio.
 * Logs a warning and continues if the command exits non-zero.
 */
export function runBestEffort(cmd: string, args: string[], opts?: SpawnOpts): void {
  const code = runRaw(cmd, args, opts)
  if (code !== 0) {
    console.warn(`  (non-zero exit ${code}, continuing) ${cmd} ${args.join(' ')}`)
  }
}

/** Resolves the absolute path of an executable using Bun's `which`. */
export function which(bin: string): string | null {
  return Bun.which(bin) ?? null
}

/**
 * Returns the absolute path of Bun's configured global bin directory,
 * preferring `bun pm bin -g` when available, then $BUN_INSTALL, then
 * the default `~/.bun/bin`.
 */
export function getBunGlobalBinDir(): string {
  try {
    const proc = Bun.spawnSync(['bun', 'pm', 'bin', '-g'], {
      stdio: ['ignore', 'pipe', 'ignore'],
      env: process.env as Record<string, string>
    })
    if (proc.exitCode === 0) {
      const dir = new TextDecoder().decode(proc.stdout).trim()
      if (dir) return dir
    }
  } catch {
    console.warn('Unable to query bun pm bin -g, falling back to env-based inference')
  }

  const bunInstall = process.env.BUN_INSTALL
  if (bunInstall) {
    return join(bunInstall, 'bin')
  }

  const home = process.env.HOME ?? process.env.USERPROFILE
  if (!home) {
    die('Cannot determine Bun global bin directory. Set HOME, USERPROFILE, or BUN_INSTALL.')
  }
  return join(home, '.bun', 'bin')
}

/**
 * Ensures Bun's global bin directory is present in the process PATH.
 */
export function ensureBunBinInPath(): void {
  const bunBin = getBunGlobalBinDir()
  const pathVar = process.env.PATH ?? ''

  if (!pathVar.split(delimiter).includes(bunBin)) {
    process.env.PATH = `${bunBin}${delimiter}${pathVar}`
  }
}

/**
 * Extracts binary names from a package.json `bin` field.
 */
export function extractBinaries(pkgName: string, binField: unknown): string[] {
  if (!binField) return []
  if (typeof binField === 'string') {
    return [pkgName.startsWith('@') ? pkgName.split('/')[1] : pkgName]
  }
  if (typeof binField === 'object' && binField !== null) {
    return Object.keys(binField)
  }
  return []
}

/**
 * Perform a topological sort (Kahn's Algorithm) on a subset of local packages.
 */
export function topologicalSort(packages: Map<string, PackageData>): string[] {
  const inDegree = new Map<string, number>()
  const adjList = new Map<string, string[]>()

  for (const name of packages.keys()) {
    inDegree.set(name, 0)
    adjList.set(name, [])
  }

  // Build Graph: Dependency -> Dependent
  for (const [name, pkg] of packages.entries()) {
    for (const dep of pkg.localDeps) {
      if (packages.has(dep)) {
        const list = adjList.get(dep)
        if (list) list.push(name)
        inDegree.set(name, (inDegree.get(name) ?? 0) + 1)
      }
    }
  }

  const queue: string[] = []
  for (const [name, degree] of inDegree.entries()) {
    if (degree === 0) queue.push(name)
  }

  const result: string[] = []
  while (queue.length > 0) {
    const current = queue.shift() as string
    result.push(current)

    const neighbors = adjList.get(current)
    if (neighbors) {
      for (const neighbor of neighbors) {
        const degree = (inDegree.get(neighbor) ?? 1) - 1
        inDegree.set(neighbor, degree)
        if (degree === 0) {
          queue.push(neighbor)
        }
      }
    }
  }

  if (result.length !== packages.size) {
    die('Circular dependency detected in the required workspace packages!')
  }

  return result
}
