import { randomUUID } from 'node:crypto'
import { mkdirSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { deriveProjectId, resolveArchiveStoreDir } from './archive.ts'
import {
  setupCleanup,
  buildAndPackPackages,
  uninstallOldGlobals,
  verifyCommandsAbsent,
  installPackages,
  verifyCommandsPresent
} from './operations.ts'
import { die, ensureBunBinInPath, log } from './utils.ts'
import {
  findWorkspaceRoot,
  resolveWorkspaceGlobs,
  discoverWorkspacePackages,
  buildCommandToPackageMap,
  computeTopologicalOrder
} from './workspace.ts'

/**
 * Entry point: discovers the workspace, prunes the graph to the requested
 * commands, builds and packs the required packages, then installs them
 * globally and verifies the resulting binaries.
 */
function main(): void {
  const repoRoot = findWorkspaceRoot(import.meta.dir)
  const rootPkgPath = join(repoRoot, 'package.json')
  const rootPkg = JSON.parse(readFileSync(rootPkgPath, 'utf-8'))

  log(`=== Starting Command Installation ===`)
  log(`Workspace Root: ${repoRoot}`)

  const workspaceGlobs = resolveWorkspaceGlobs(rootPkg)
  const allPackagesMap = discoverWorkspacePackages(repoRoot, workspaceGlobs)
  if (allPackagesMap.size === 0) die('No packages found in workspace.')

  for (const pkg of allPackagesMap.values()) {
    pkg.localDeps = pkg.localDeps.filter((dep) => allPackagesMap.has(dep))
  }

  const commandToPackage = buildCommandToPackageMap(allPackagesMap)
  if (commandToPackage.size === 0) {
    die('No commands (binaries) found in any workspace packages. Nothing to install.')
  }

  const requestedCommands = process.argv.slice(2)
  const targetCommands =
    requestedCommands.length > 0 ? requestedCommands : Array.from(commandToPackage.keys())

  const topoOrder = computeTopologicalOrder(targetCommands, allPackagesMap, commandToPackage)

  log(`\nTarget commands: ${targetCommands.join(', ')}`)
  log(`Graph pruned to ${topoOrder.length} required packages. Build order:`)
  topoOrder.forEach((p, i) => log(`  ${i + 1}. ${p}`))

  const tmpDir = join(tmpdir(), `bun-install-cmd-${randomUUID()}`)
  mkdirSync(tmpDir, { recursive: true })
  const cleanup = setupCleanup(tmpDir)

  try {
    ensureBunBinInPath()

    const projectId = deriveProjectId(repoRoot, rootPkg.name)
    const archiveStoreDir = resolveArchiveStoreDir(projectId)
    log(`Archive store: ${archiveStoreDir}`)

    buildAndPackPackages(topoOrder, allPackagesMap, archiveStoreDir, tmpDir)
    uninstallOldGlobals(topoOrder)
    verifyCommandsAbsent(targetCommands)
    installPackages(topoOrder, allPackagesMap)
    verifyCommandsPresent(targetCommands)

    log('\n=== Success! Requested commands have been globally installed. ===')
  } finally {
    cleanup()
  }
}

main()
