import { randomUUID } from 'node:crypto'
import { mkdirSync, readdirSync, rmSync } from 'node:fs'
import { join, resolve, sep } from 'node:path'

import { moveIntoStore } from './archive.ts'
import type { PackageData } from './types.ts'
import { EXIT_SIGNALS } from './types.ts'
import { die, getBunGlobalBinDir, log, run, runBestEffort, which } from './utils.ts'

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
 * Iterates the topologically-sorted packages, conditionally runs `bun run build`,
 * packs each one, and moves the resulting tarball into the persistent archive store.
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
 * Verifies that none of the target commands are currently reachable in PATH.
 * If a stale binary remains inside Bun's global bin directory after `bun remove -g`,
 * it is force-removed and logged. Any binary found outside the Bun global bin
 * directory is treated as an unexpected collision and aborts the script.
 */
export function verifyCommandsAbsent(targetCommands: string[]): void {
  log('\nVerifying absence of target commands in PATH...')
  const bunBinDir = getBunGlobalBinDir()

  for (const bin of targetCommands) {
    let resolved = which(bin)
    if (resolved === null) continue

    const normalizedResolved = resolve(resolved)
    const normalizedBunBinDir = resolve(bunBinDir)
    const isInBunBinDir =
      normalizedResolved.startsWith(normalizedBunBinDir + sep) ||
      normalizedResolved === normalizedBunBinDir

    if (isInBunBinDir) {
      log(
        `  WARNING: '${bin}' is still present at ${resolved} after uninstall. Removing stale entry...`
      )
      try {
        rmSync(resolved, { force: true })
      } catch (err: unknown) {
        die(
          `Failed to remove stale binary '${bin}' at ${resolved}: ${err instanceof Error ? err.message : String(err)}`
        )
      }
      // Re-verify after manual removal — if something else resolves the
      // same name (e.g. a system package further down in PATH), we treat
      // that as a legitimate collision.
      resolved = which(bin)
      if (resolved !== null) {
        die(`Binary '${bin}' is still present at: ${resolved} after attempted removal`)
      }
    } else {
      die(`Binary '${bin}' is still present at: ${resolved} (outside Bun global bin dir)`)
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
 * Verifies that each target command is now reachable in PATH after installation.
 * Throws (via {@link die}) if any command is missing.
 */
export function verifyCommandsPresent(targetCommands: string[]): void {
  log('\nVerifying presence of target commands in PATH...')
  for (const bin of targetCommands) {
    const resolved = which(bin)
    if (resolved === null) {
      die(`Binary '${bin}' was not found in PATH after installation!`)
    }
    log(`  Verified: '${bin}' -> ${resolved}`)
  }
}
