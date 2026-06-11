import { randomUUID } from 'node:crypto'
import {
  lstatSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  readlinkSync,
  readSync,
  rmSync,
  writeFileSync,
  cpSync
} from 'node:fs'
import { join, resolve, sep } from 'node:path'

import { moveIntoStore } from './archive.ts'
import type { PackageData } from './types.ts'
import { EXIT_SIGNALS } from './types.ts'
import { die, log, run, runBestEffort, which } from './utils.ts'

/**
 * Registers process signal handlers to clean up the temporary directory on exit.
 * Returns a callable cleanup function for explicit invocation.
 */
export function setupCleanup(tmpDir: string): () => void {
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

  return cleanup
}

/**
 * Prompts the user for a yes/no confirmation on stdout/stdin.
 * Returns `true` only when the user types "y" or "yes" (case-insensitive).
 * Returns `false` for non-TTY stdin, empty input, or any read failure,
 * and logs the refusal reason so the caller can abort or continue.
 */
function confirmAction(msg: string): boolean {
  if (!process.stdin.isTTY) {
    log(`  ${msg}`)
    log('  (stdin is not a TTY — cannot prompt. Run interactively to confirm.)')
    return false
  }

  process.stdout.write(`  ${msg} [y/N] `)
  const buf = Buffer.alloc(256)
  let bytesRead: number
  try {
    bytesRead = readSync(0, buf, 0, 256)
  } catch {
    return false
  }
  if (bytesRead <= 0) return false
  const answer = buf.toString('utf-8', 0, bytesRead).trim().toLowerCase()
  return answer === 'y' || answer === 'yes'
}

/**
 * Iterates the topologically-sorted packages, conditionally runs `bun run build`,
 * packs each one, and moves the resulting tarball into the persistent archive store.
 *
 * Before packing, workspace-local dependencies are temporarily pinned to the
 * absolute tarball paths of already-packed workspace siblings so that the
 * resulting archive contains `file:` references. This ensures `bun add -g`
 * resolves those dependencies from the local snapshots rather than the registry.
 */
export function buildAndPackPackages(
  topoOrder: string[],
  packagesMap: Map<string, PackageData>,
  archiveStoreDir: string,
  tmpDir: string
): void {
  log('\nBuilding and Packaging required modules...')
  for (const pkgName of topoOrder) {
    const pkg = packagesMap.get(pkgName)
    if (!pkg) die(`Package ${pkgName} not found in map`)

    log(`\n--- Processing ${pkgName} ---`)

    if (pkg.hasBuildScript) {
      log(`Building ${pkgName}...`)
      run('bun', ['run', 'build'], { cwd: pkg.dir })
    }

    // Create a throwaway copy of the package directory for packing so that
    // dependency pinning never mutates the real workspace. This avoids signal-
    // safety issues (SIGINT can skip finally blocks that restore mutated files).
    const packDir = join(tmpDir, randomUUID())
    cpSync(pkg.dir, packDir, {
      recursive: true,
      filter: (src) => !src.split(/[/\\]/).some((seg) => seg === 'node_modules')
    })

    // Pin workspace-local dependencies to their already-packed tarball paths
    // in the throwaway copy so that the packed archive's package.json points
    // to local snapshots instead of the registry.
    const pkgJsonPath = join(packDir, 'package.json')
    const pkgJson = JSON.parse(readFileSync(pkgJsonPath, 'utf-8'))
    let pinned = false

    for (const depType of ['dependencies', 'peerDependencies'] as const) {
      const deps = pkgJson[depType]
      if (!deps) continue
      for (const depName of Object.keys(deps)) {
        const depPkg = packagesMap.get(depName)
        if (depPkg?.archivePath) {
          deps[depName] = `file:${depPkg.archivePath}`
          pinned = true
        }
      }
    }

    if (pinned) {
      writeFileSync(pkgJsonPath, JSON.stringify(pkgJson, null, 2) + '\n')
      log(`  Pinned workspace dependencies to local tarballs`)
    }

    log(`Packing ${pkgName}...`)
    const isolatedPkgTmp = join(tmpDir, randomUUID())
    mkdirSync(isolatedPkgTmp, { recursive: true })

    run('bun', ['pm', 'pack', '--destination', isolatedPkgTmp], {
      cwd: packDir
    })

    const archives = readdirSync(isolatedPkgTmp).filter((f) => f.endsWith('.tgz'))
    if (archives.length !== 1) {
      die(`Expected exactly 1 archive in ${isolatedPkgTmp}, found ${archives.length}`)
    }

    const archiveFilename = archives[0]
    const sourceArchive = join(isolatedPkgTmp, archiveFilename)
    const persistentArchive = join(archiveStoreDir, archiveFilename)

    moveIntoStore(sourceArchive, persistentArchive)
    pkg.archivePath = persistentArchive
  }
}

/**
 * Uninstalls existing global installations in reverse topological order.
 * Uses best-effort removal so missing packages do not abort the script.
 */
export function uninstallOldGlobals(topoOrder: string[]): void {
  log('\nRemoving existing global installations (reverse topological order)...')
  const removeOrder = [...topoOrder].reverse()
  for (const pkgName of removeOrder) {
    runBestEffort('bun', ['remove', '-g', pkgName])
  }
}

/**
 * Verifies that none of the target commands are currently reachable via the
 * Bun global bin directory. If a stale binary is found inside Bun's bin dir,
 * the user is prompted for confirmation before removal. Binaries found outside
 * Bun's bin dir are treated as unexpected collisions and abort the script.
 */
export function verifyCommandsAbsent(targetCommands: string[], bunBinDir: string): void {
  log('\nVerifying absence of target commands in PATH...')
  const normalizedBunBinDir = resolve(bunBinDir)
  const isWindows = process.platform === 'win32'
  const comparePath = isWindows
    ? (p: string) => resolve(p).toLowerCase()
    : (p: string) => resolve(p)
  const binDirKey = comparePath(bunBinDir)

  for (const bin of targetCommands) {
    let resolved = which(bin)
    if (resolved === null) continue

    const resolvedKey = comparePath(resolved)
    const isInBunBinDir = resolvedKey.startsWith(binDirKey + sep) || resolvedKey === binDirKey

    if (isInBunBinDir) {
      // Verify ownership: only remove if the binary appears to be a Bun-generated
      // wrapper (symlink into Bun's global install, or a small JS shim referencing
      // the Bun global install path). This prevents accidentally deleting a
      // wrapper belonging to another globally installed Bun package.
      let ownedByBunGlobal = false
      try {
        const stat = lstatSync(resolved)
        if (stat.isSymbolicLink()) {
          const target = readlinkSync(resolved)
          ownedByBunGlobal = target.includes('install/global') || target.includes('node_modules')
        } else {
          // Regular file — Bun wrappers are typically small JS shims.
          // Check if the content references the Bun global install path.
          const content = readFileSync(resolved, 'utf-8')
          ownedByBunGlobal = content.includes('install/global') || content.includes('@bun')
        }
      } catch {
        // Inspection failed — do NOT assume ownership. Require manual removal.
        ownedByBunGlobal = false
      }

      if (!ownedByBunGlobal) {
        die(
          `Binary '${bin}' at ${resolved} appears to belong to another package. Remove it manually and re-run.`
        )
      }

      const shouldRemove = confirmAction(
        `Binary '${bin}' is still present at ${resolved} after uninstall.\n  Remove it?`
      )
      if (shouldRemove) {
        try {
          rmSync(resolved, { force: true })
        } catch (err: unknown) {
          die(
            `Failed to remove stale binary '${bin}' at ${resolved}: ${err instanceof Error ? err.message : String(err)}`
          )
        }
        // Re-verify after removal — if something else resolves the
        // same name (e.g. a system package further down in PATH), we treat
        // that as a legitimate collision.
        resolved = which(bin)
        if (resolved !== null) {
          die(`Binary '${bin}' is still present at: ${resolved} after attempted removal`)
        }
      } else {
        die(`Aborting: binary '${bin}' remains at ${resolved}. Remove it manually and re-run.`)
      }
    } else {
      die(`Binary '${bin}' is present at: ${resolved} (outside Bun global bin dir). Aborting.`)
    }
  }
}

/**
 * Installs each required package globally from its cached archive using `bun add -g`.
 */
export function installPackages(topoOrder: string[], packagesMap: Map<string, PackageData>): void {
  log('\nInstalling packages globally...')
  for (const pkgName of topoOrder) {
    const pkg = packagesMap.get(pkgName)
    if (!pkg) die(`Package ${pkgName} not found in map`)
    if (!pkg.archivePath) die(`Archive path missing for ${pkgName}`)

    log(`  Installing ${pkgName}...`)
    run('bun', ['add', '-g', '--minimum-release-age=0', pkg.archivePath])
  }
}

/**
 * Verifies that each target command is now reachable in PATH after installation
 * AND that the resolved binary actually lives inside Bun's global bin directory.
 * This prevents false positives when an unrelated executable shadows the
 * Bun-installed one.
 */
export function verifyCommandsPresent(targetCommands: string[], bunBinDir: string): void {
  log('\nVerifying presence of target commands in PATH...')
  const normalizedBunBinDir = resolve(bunBinDir)
  const isWindows = process.platform === 'win32'
  const comparePath = isWindows
    ? (p: string) => resolve(p).toLowerCase()
    : (p: string) => resolve(p)
  const binDirKey = comparePath(bunBinDir)
  for (const bin of targetCommands) {
    const resolved = which(bin)
    if (resolved === null) {
      die(`Binary '${bin}' was not found in PATH after installation!`)
    }
    const resolvedKey = comparePath(resolved)
    const isInBunBinDir = resolvedKey.startsWith(binDirKey + sep) || resolvedKey === binDirKey
    if (!isInBunBinDir) {
      die(
        `Binary '${bin}' resolved to ${resolved}, which is outside Bun's global bin dir (${bunBinDir}). The Bun-installed version may be shadowed by another provider.`
      )
    }
    log(`  Verified: '${bin}' -> ${resolved}`)
  }
}
