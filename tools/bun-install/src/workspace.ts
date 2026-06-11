import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'

import type { PackageData } from './types.ts'
import { die, extractBinaries, topologicalSort } from './utils.ts'

/**
 * Traverses upwards from the script directory to find the monorepo root.
 * We identify the root by looking for a package.json with a "workspaces" field.
 */
export function findWorkspaceRoot(startDir: string): string {
  let current = startDir
  while (true) {
    const pkgPath = join(current, 'package.json')
    if (existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'))
        if (pkg.workspaces) return current
      } catch {
        console.warn('Ignoring unparseable package.json during workspace discovery')
      }
    }
    const parent = dirname(current)
    if (parent === current)
      die(
        "Could not auto-discover workspace root. No package.json with a 'workspaces' field found in any parent directory."
      )
    current = parent
  }
}

/**
 * Resolves workspace glob patterns from the root package.json,
 * supporting both array and object-with-packages shapes.
 */
export function resolveWorkspaceGlobs(rootPkg: Record<string, unknown>): string[] {
  if (
    Array.isArray(rootPkg.workspaces) &&
    rootPkg.workspaces.every((glob): glob is string => typeof glob === 'string')
  ) {
    return rootPkg.workspaces
  }
  const workspaces = rootPkg.workspaces as { packages?: unknown } | undefined
  if (
    Array.isArray(workspaces?.packages) &&
    workspaces.packages.every((glob): glob is string => typeof glob === 'string')
  ) {
    return workspaces.packages
  }
  console.warn(
    'Warning: workspaces field is neither an array nor an object with a packages key. No workspace packages will be discovered.'
  )
  return []
}

/**
 * Scans the workspace glob patterns and returns a map of every local package
 * with metadata needed for the rest of the pipeline.
 */
export function discoverWorkspacePackages(
  repoRoot: string,
  workspaceGlobs: string[]
): Map<string, PackageData> {
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

        // Only runtime deps (dependencies + peerDependencies) are needed for the
        // install graph.  devDependencies are used during build but are not
        // required at runtime by the globally-installed commands.
        const allDeps = [
          ...Object.keys(pkgData.dependencies ?? {}),
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
        console.warn(`Ignoring unparseable package.json at ${absPath}`)
      }
    }
  }

  return allPackagesMap
}

/**
 * Builds a map from binary/command name to the workspace package that provides it.
 * Warns when a command name is defined by multiple packages.
 */
export function buildCommandToPackageMap(
  allPackagesMap: Map<string, PackageData>
): Map<string, string> {
  const commandToPackage = new Map<string, string>()
  for (const [pkgName, pkg] of allPackagesMap.entries()) {
    for (const bin of pkg.bins) {
      if (commandToPackage.has(bin)) {
        die(
          `Command '${bin}' is defined by both '${commandToPackage.get(bin)}' and '${pkgName}'. Resolve the collision before installing.`
        )
      }
      commandToPackage.set(bin, pkgName)
    }
  }
  return commandToPackage
}

/**
 * Starting from the requested commands, performs a BFS over the local runtime
 * dependency graph to find the minimal set of packages required, then returns
 * them in topologically-sorted build order.
 */
export function computeTopologicalOrder(
  targetCommands: string[],
  allPackagesMap: Map<string, PackageData>,
  commandToPackage: Map<string, string>
): string[] {
  const entryPackages = new Set<string>()
  for (const cmd of targetCommands) {
    const pkgName = commandToPackage.get(cmd)
    if (!pkgName) die(`Requested command '${cmd}' was not found in any workspace package.`)
    entryPackages.add(pkgName)
  }

  const requiredPackages = new Set<string>()
  const bfsQueue = Array.from(entryPackages)

  while (bfsQueue.length > 0) {
    const current = bfsQueue.shift() as string
    if (!requiredPackages.has(current)) {
      requiredPackages.add(current)
      const pkgData = allPackagesMap.get(current)
      if (pkgData) bfsQueue.push(...pkgData.localDeps)
    }
  }

  const prunedPackagesMap = new Map<string, PackageData>()
  for (const pkgName of requiredPackages) {
    const pkgData = allPackagesMap.get(pkgName)
    if (pkgData) prunedPackagesMap.set(pkgName, pkgData)
  }

  return topologicalSort(prunedPackagesMap)
}
