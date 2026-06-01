#!/usr/bin/env bun
/**
 * Dynamically builds and installs workspace binaries as Bun globals.
 * * Usage:
 * bun hack/dev-bun-install-global-command.ts [command1] [command2] ...
 * (If no commands are provided, installs ALL discovered commands)
 *
 * Features:
 * - Auto-discovers workspace root.
 * - Prunes the build graph to ONLY include packages required for the target commands.
 * - Deterministic, isolated packing.
 * - Cross-platform (Windows/macOS/Linux).
 * - Persists pack output to a platform-appropriate cache directory so Bun's
 *   global install (which records the absolute tarball path) remains valid
 *   after the script's own per-run temp directory is cleaned up.
 */

import { randomUUID } from 'node:crypto'
import {
  existsSync,
  readdirSync,
  readFileSync,
  mkdirSync,
  rmSync,
  cpSync,
  renameSync
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve, delimiter, dirname } from 'node:path'

// ---------------------------------------------------------------------------
// Runtime Guard
// ---------------------------------------------------------------------------
if (typeof Bun === 'undefined') {
  console.error('FATAL: This script requires the Bun runtime. Run with: bun <script>')
  process.exit(1)
}

// ---------------------------------------------------------------------------
// Types & State
// ---------------------------------------------------------------------------

type PackageData = {
  name: string
  dir: string
  bins: string[]
  localDeps: string[]
  hasBuildScript: boolean
  archivePath?: string // Populated after packing
}

const EXIT_SIGNALS = ['SIGINT', 'SIGTERM', 'SIGHUP'] as const

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function log(msg: string): void {
  console.log(msg)
}

function die(msg: string): never {
  console.error(`\nFATAL: ${msg}`)
  process.exit(1)
}

type SpawnOpts = { cwd?: string }

function runRaw(cmd: string, args: string[], opts?: SpawnOpts): number {
  const proc = Bun.spawnSync([cmd, ...args], {
    cwd: opts?.cwd,
    stdio: ['inherit', 'inherit', 'inherit'],
    env: process.env as Record<string, string>
  })
  return proc.exitCode ?? 1
}

function run(cmd: string, args: string[], opts?: SpawnOpts): void {
  const code = runRaw(cmd, args, opts)
  if (code !== 0) {
    die(`Command failed (exit ${code}): ${cmd} ${args.join(' ')}`)
  }
}

function runBestEffort(cmd: string, args: string[], opts?: SpawnOpts): void {
  const code = runRaw(cmd, args, opts)
  if (code !== 0) {
    console.warn(`  (non-zero exit ${code}, continuing) ${cmd} ${args.join(' ')}`)
  }
}

function which(bin: string): string | null {
  return Bun.which(bin) ?? null
}

function ensureBunBinInPath(): void {
  const home = process.env.HOME ?? process.env.USERPROFILE
  if (!home) die('Neither HOME nor USERPROFILE is set — cannot locate ~/.bun/bin')

  const bunBin = join(home, '.bun', 'bin')
  const pathVar = process.env.PATH ?? ''

  if (!pathVar.split(delimiter).includes(bunBin)) {
    process.env.PATH = `${bunBin}${delimiter}${pathVar}`
  }
}

/**
 * Traverses upwards from the script directory to find the monorepo root.
 * We identify the root by looking for a package.json with a "workspaces" field.
 */
function findWorkspaceRoot(startDir: string): string {
  let current = startDir
  while (true) {
    const pkgPath = join(current, 'package.json')
    if (existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'))
        if (pkg.workspaces) return current
      } catch {
        // Ignore parse errors, continue up
      }
    }
    const parent = dirname(current)
    if (parent === current) {
      die(
        "Could not auto-discover workspace root. No package.json with a 'workspaces' field found in any parent directory."
      )
    }
    current = parent
  }
}

/**
 * Extracts binary names from a package.json `bin` field.
 */
function extractBinaries(pkgName: string, binField: unknown): string[] {
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
function topologicalSort(packages: Map<string, PackageData>): string[] {
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
        adjList.get(dep)!.push(name)
        inDegree.set(name, inDegree.get(name)! + 1)
      }
    }
  }

  const queue: string[] = []
  for (const [name, degree] of inDegree.entries()) {
    if (degree === 0) queue.push(name)
  }

  const result: string[] = []
  while (queue.length > 0) {
    const current = queue.shift()!
    result.push(current)

    for (const neighbor of adjList.get(current)!) {
      inDegree.set(neighbor, inDegree.get(neighbor)! - 1)
      if (inDegree.get(neighbor) === 0) {
        queue.push(neighbor)
      }
    }
  }

  if (result.length !== packages.size) {
    die('Circular dependency detected in the required workspace packages!')
  }

  return result
}

/**
 * Returns the absolute path of a persistent, platform-appropriate directory
 * where pack output (.tgz tarballs) should be stored so that it outlives
 * this script's per-run temp directory.
 *
 * `bun add -g` records the absolute path of the tarball it installed from
 * in its global install metadata. If we leave the tarball in a per-run temp
 * dir, that recorded path becomes a dangling reference the moment we (or the
 * OS) clean up the temp dir. So we move it to a long-lived, conventional
 * location per platform:
 *
 *   - macOS:    ~/Library/Caches/<projectId>/install-command-archives
 *   - Linux:    ${XDG_CACHE_HOME:-~/.cache}/<projectId>/install-command-archives
 *   - Windows:  %LOCALAPPDATA%\<projectId>\Cache\install-command-archives
 *
 * The directory is NOT created here -- `moveIntoStore` will create it on
 * first use so we don't litter the user's filesystem with empty dirs.
 */
function resolveArchiveStoreDir(projectId: string): string {
  const subdir = 'install-command-archives'

  if (process.platform === 'win32') {
    const localAppData = process.env.LOCALAPPDATA
    if (!localAppData) {
      die('LOCALAPPDATA is not set on Windows; cannot determine a persistent store directory.')
    }
    return join(localAppData, projectId, 'Cache', subdir)
  }

  if (process.platform === 'darwin') {
    const home = process.env.HOME ?? process.env.USERPROFILE
    if (!home) {
      die('Neither HOME nor USERPROFILE is set; cannot determine a persistent store directory.')
    }
    return join(home, 'Library', 'Caches', projectId, subdir)
  }

  // Linux and other Unix-likes: prefer XDG_CACHE_HOME, fall back to ~/.cache.
  const xdgCache = process.env.XDG_CACHE_HOME
  if (xdgCache) {
    return join(xdgCache, projectId, subdir)
  }
  const home = process.env.HOME ?? process.env.USERPROFILE
  if (!home) {
    die(
      'Neither HOME, USERPROFILE, nor XDG_CACHE_HOME is set; cannot determine a persistent store directory.'
    )
  }
  return join(home, '.cache', projectId, subdir)
}

/**
 * Derives a filesystem-safe project identifier from the workspace root's
 * `package.json` `name` field, with a fallback to the repo's basename.
 *
 * The result is constrained to `[a-zA-Z0-9._-]` (no separators, no NUL, no
 * leading dots/dashes/underscores) so it is safe to embed in a path on every
 * supported platform, including Windows (where `:` and `/` would break).
 */
function deriveProjectId(repoRoot: string, rootPkgName: unknown): string {
  const sanitize = (raw: string): string | null => {
    const cleaned = raw.replace(/[^a-zA-Z0-9._-]/g, '_').replace(/^[._-]+/, '')
    return cleaned.length > 0 ? cleaned : null
  }

  if (typeof rootPkgName === 'string') {
    const fromPkg = sanitize(rootPkgName)
    if (fromPkg) return fromPkg
  }

  // Fallback: use the last path component of the repo root.
  const base = repoRoot.split(/[\\/]/).pop() ?? ''
  const fromDir = sanitize(base)
  if (fromDir) return fromDir

  return 'project'
}

/**
 * Atomically move a file to `destPath`, replacing any existing file there.
 *
 * The destination's parent directory is created if it does not exist.
 *
 * Atomicity contract:
 *
 *   - POSIX (macOS, Linux, *BSD, ...): `rename(2)` is atomic on the same
 *     filesystem. Any process that has the previous tarball open (e.g. a
 *     `bun` resolver still reading it, or another instance of this script
 *     racing) will see either the old contents or the new contents in their
 *     entirety -- never a partial or mixed state. This is exactly what we
 *     need to prevent consumers from picking up a half-written tarball
 *     when this script runs again.
 *
 *   - Windows: Node's `fs.rename` uses `MoveFileEx(MOVEFILE_REPLACE_EXISTING)`.
 *     If the destination is in use (ERROR_SHARING_VIOLATION -> EBUSY, or
 *     ERROR_ACCESS_DENIED -> EACCES/EPERM) the rename fails and we fall
 *     back to copy + remove. The fallback is NOT atomic -- there is a brief
 *     window during which the destination is being truncated and rewritten
 *     -- but it is the strongest guarantee available on that platform.
 *
 *   - Cross-device (EXDEV): rare on a single-user machine, but handled by
 *     a non-atomic copy + remove so the script still succeeds.
 */
function moveIntoStore(srcPath: string, destPath: string): void {
  mkdirSync(dirname(destPath), { recursive: true })

  if (process.platform === 'win32') {
    // Best effort: try the atomic rename first; fall back to copy + remove
    // if the destination is open or otherwise unrenamable on Windows.
    try {
      renameSync(srcPath, destPath)
      return
    } catch {
      // Fall through to copy + remove.
    }
    cpSync(srcPath, destPath, { force: true })
    try {
      rmSync(srcPath, { force: true })
    } catch {
      // The script-level temp-dir cleanup at the end of main() will sweep
      // up the leftover source.
    }
    return
  }

  // POSIX: rename(2) on the same filesystem is atomic. Same-filesystem
  // is overwhelmingly the common case here (both paths live under the
  // user's home/cache).
  try {
    renameSync(srcPath, destPath)
  } catch (err: unknown) {
    const code = (err as NodeJS.ErrnoException)?.code
    if (code === 'EXDEV') {
      // Cross-device link: not atomic, but at least it will succeed.
      cpSync(srcPath, destPath, { force: true })
      rmSync(srcPath, { force: true })
      return
    }
    throw err
  }
}

// ---------------------------------------------------------------------------
// Main Pipeline
// ---------------------------------------------------------------------------

function main(): void {
  // 1. Auto-discover workspace
  const repoRoot = findWorkspaceRoot(import.meta.dir)
  const rootPkgPath = join(repoRoot, 'package.json')
  const rootPkg = JSON.parse(readFileSync(rootPkgPath, 'utf-8'))

  log(`=== Starting Command Installation ===`)
  log(`Workspace Root: ${repoRoot}`)

  let workspaceGlobs: string[] = []
  if (Array.isArray(rootPkg.workspaces)) {
    workspaceGlobs = rootPkg.workspaces
  } else if (rootPkg.workspaces?.packages) {
    workspaceGlobs = rootPkg.workspaces.packages
  } else {
    workspaceGlobs = ['.']
  }

  // 2. Discover all packages in the workspace
  const allPackagesMap = new Map<string, PackageData>()

  for (const globStr of workspaceGlobs) {
    const pattern = globStr.endsWith('package.json') ? globStr : `${globStr}/package.json`
    const glob = new Bun.Glob(pattern)

    for (const relativePath of glob.scanSync({ cwd: repoRoot })) {
      const absPath = resolve(repoRoot, relativePath)
      const pkgDir = dirname(absPath)

      if (pkgDir === repoRoot && workspaceGlobs.length > 1) continue

      try {
        const pkgData = JSON.parse(readFileSync(absPath, 'utf-8'))
        if (!pkgData.name) continue

        const allDeps = [
          ...Object.keys(pkgData.dependencies ?? {}),
          ...Object.keys(pkgData.devDependencies ?? {}),
          ...Object.keys(pkgData.peerDependencies ?? {})
        ]

        allPackagesMap.set(pkgData.name, {
          name: pkgData.name,
          dir: pkgDir,
          bins: extractBinaries(pkgData.name, pkgData.bin),
          localDeps: allDeps,
          hasBuildScript: !!pkgData.scripts?.build
        })
      } catch {
        // Ignore unparseable package.json files
      }
    }
  }

  if (allPackagesMap.size === 0) die('No packages found in workspace.')

  // Clean local dependencies to only reference other valid local packages
  for (const pkg of allPackagesMap.values()) {
    pkg.localDeps = pkg.localDeps.filter((dep) => allPackagesMap.has(dep))
  }

  // 3. Map available commands to their parent packages
  const commandToPackage = new Map<string, string>()
  for (const [pkgName, pkg] of allPackagesMap.entries()) {
    for (const bin of pkg.bins) {
      if (commandToPackage.has(bin)) {
        console.warn(`Warning: Command '${bin}' is defined in multiple packages. Using ${pkgName}`)
      }
      commandToPackage.set(bin, pkgName)
    }
  }

  if (commandToPackage.size === 0) {
    die('No commands (binaries) found in any workspace packages. Nothing to install.')
  }

  // 4. Determine target commands from CLI arguments
  const requestedCommands = process.argv.slice(2)
  const targetCommands =
    requestedCommands.length > 0 ? requestedCommands : Array.from(commandToPackage.keys())

  // 5. Prune the graph: Keep only entry-point packages and their transitive dependencies
  const entryPackages = new Set<string>()
  for (const cmd of targetCommands) {
    const pkgName = commandToPackage.get(cmd)
    if (!pkgName) die(`Requested command '${cmd}' was not found in any workspace package.`)
    entryPackages.add(pkgName)
  }

  const requiredPackages = new Set<string>()
  const queue = Array.from(entryPackages)

  while (queue.length > 0) {
    const current = queue.shift()!
    if (!requiredPackages.has(current)) {
      requiredPackages.add(current)
      const deps = allPackagesMap.get(current)!.localDeps
      queue.push(...deps)
    }
  }

  // Build the final pruned map
  const prunedPackagesMap = new Map<string, PackageData>()
  for (const pkgName of requiredPackages) {
    prunedPackagesMap.set(pkgName, allPackagesMap.get(pkgName)!)
  }

  // 6. Topologically Sort the pruned packages
  const topoOrder = topologicalSort(prunedPackagesMap)

  log(`\nTarget commands: ${targetCommands.join(', ')}`)
  log(`Graph pruned to ${topoOrder.length} required packages. Build order:`)
  topoOrder.forEach((p, i) => log(`  ${i + 1}. ${p}`))

  // 7. Setup Temp and Cleanup logic
  const tmpDir = join(tmpdir(), `bun-install-cmd-${randomUUID()}`)
  mkdirSync(tmpDir, { recursive: true })

  let cleanedUp = false
  function cleanup(): void {
    if (cleanedUp) return
    cleanedUp = true
    log('\nCleaning up temporary files...')
    try {
      rmSync(tmpDir, { recursive: true, force: true })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`Warning: failed to remove temp dir ${tmpDir}: ${msg}`)
    }
  }

  process.on('exit', cleanup)
  for (const sig of EXIT_SIGNALS) {
    process.on(sig, () => {
      cleanup()
      process.exit(1)
    })
  }

  try {
    ensureBunBinInPath()

    // Resolve the persistent archive store directory once for the whole run.
    // See `resolveArchiveStoreDir` for the per-platform conventions used.
    const projectId = deriveProjectId(repoRoot, rootPkg.name)
    const archiveStoreDir = resolveArchiveStoreDir(projectId)
    log(`Archive store: ${archiveStoreDir}`)

    // 8. Build and Pack
    log('\nBuilding and Packaging required modules...')
    for (const pkgName of topoOrder) {
      const pkg = prunedPackagesMap.get(pkgName)!
      log(`\n--- Processing ${pkgName} ---`)

      if (pkg.hasBuildScript) {
        log(`Building ${pkgName}...`)
        run('bun', ['run', 'build'], { cwd: pkg.dir })
      }

      log(`Packing ${pkgName}...`)
      const isolatedPkgTmp = join(tmpDir, randomUUID())
      mkdirSync(isolatedPkgTmp, { recursive: true })

      run('bun', ['pm', 'pack', '--destination', isolatedPkgTmp], {
        cwd: pkg.dir
      })

      const archives = readdirSync(isolatedPkgTmp).filter((f) => f.endsWith('.tgz'))
      if (archives.length !== 1) {
        die(`Expected exactly 1 archive in ${isolatedPkgTmp}, found ${archives.length}`)
      }

      const archiveFilename = archives[0]
      const sourceArchive = join(isolatedPkgTmp, archiveFilename)
      const persistentArchive = join(archiveStoreDir, archiveFilename)

      // Move the freshly packed tarball into the persistent store. The temp
      // path will be swept up by cleanup() below, but `bun add -g` records
      // the absolute path we hand it, so it MUST live somewhere that
      // outlives the per-run temp dir. `moveIntoStore` does an atomic
      // rename on Unix so any consumer that still holds the previous
      // tarball cannot observe a partial write.
      moveIntoStore(sourceArchive, persistentArchive)
      pkg.archivePath = persistentArchive
    }

    // 9. Uninstall old global versions
    log('\nRemoving existing global installations (reverse topological order)...')
    const removeOrder = [...topoOrder].reverse()
    for (const pkgName of removeOrder) {
      runBestEffort('bun', ['remove', '-g', pkgName])
    }

    // 10. Verify absence in PATH
    log('\nVerifying absence of target commands in PATH...')
    for (const bin of targetCommands) {
      const resolved = which(bin)
      if (resolved !== null) {
        die(`Binary '${bin}' is still present at: ${resolved}`)
      }
    }

    // 11. Install packages globally
    log('\nInstalling packages globally...')
    for (const pkgName of topoOrder) {
      const pkg = prunedPackagesMap.get(pkgName)!
      if (!pkg.archivePath) die(`Archive path missing for ${pkgName}`)

      log(`  Installing ${pkgName}...`)
      run('bun', ['add', '-g', '--minimum-release-age=0', pkg.archivePath])
    }

    // 12. Verify binaries presence
    log('\nVerifying presence of target commands in PATH...')
    for (const bin of targetCommands) {
      const resolved = which(bin)
      if (resolved === null) {
        die(`Binary '${bin}' was not found in PATH after installation!`)
      }
      log(`  Verified: '${bin}' -> ${resolved}`)
    }

    log('\n=== Success! Requested commands have been globally installed. ===')
  } finally {
    cleanup()
  }
}

main()
