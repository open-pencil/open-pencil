import { existsSync } from 'node:fs'
import { cp, mkdir, rm, writeFile } from 'node:fs/promises'
import { basename, dirname, join } from 'node:path'

import {
  discoverPublicPackages,
  parseNpmPack,
  readPackageManifest,
  runCommand,
  type PackageManifest,
  type WorkspacePackage
} from '@open-pencil/package-artifacts'

import { NPM_RELEASE_POLICY } from './policy'

export interface PackagePublishConfig {
  directory: string
}

/** Lists the files `npm pack` would ship from a package directory, relative to it. */
export type PackageFileLister = (sourceDir: string) => Promise<string[]>

export interface PreparePublishDirectoriesOptions {
  coreVersion: string
  packages: PackagePublishConfig[]
  root: string
  outRoot?: string
  /** Defaults to a real `npm pack --dry-run`; tests inject a listing to stay out of npm. */
  listPackageFiles?: PackageFileLister
  log?: (message: string) => void
}

const PACKAGE_FIELDS = [
  'dependencies',
  'devDependencies',
  'peerDependencies',
  'optionalDependencies'
] as const satisfies ReadonlyArray<keyof PackageManifest>
const PUBLISH_CONFIG_FIELDS = new Set(['access', 'provenance', 'registry'])
const LICENSE_FILE = 'LICENSE'

export function publishPackageJSON(source: PackageManifest, coreVersion: string): PackageManifest {
  if (source.publishConfig) {
    for (const [field, expected] of Object.entries(NPM_RELEASE_POLICY)) {
      if (field in source.publishConfig && source.publishConfig[field] !== expected) {
        throw new Error(
          `${source.name}: publishConfig.${field} conflicts with the public npm release policy`
        )
      }
    }
  }
  const json = structuredClone(source)
  for (const field of ['exports', 'imports', 'main', 'types', 'bin'] as const) {
    if (
      source.publishConfig &&
      field in source.publishConfig &&
      JSON.stringify(source.publishConfig[field]) !== JSON.stringify(source[field])
    ) {
      throw new Error(`${source.name}: publishConfig must not rewrite ${field}`)
    }
  }

  for (const field of PACKAGE_FIELDS) {
    const dependencies = json[field]
    if (!dependencies) continue
    for (const [name, version] of Object.entries(dependencies)) {
      if (version.startsWith('workspace:')) dependencies[name] = `^${coreVersion}`
    }
  }

  delete json.scripts
  delete json.devDependencies

  if (json.publishConfig) {
    for (const [key, value] of Object.entries(json.publishConfig)) {
      if (!PUBLISH_CONFIG_FIELDS.has(key)) json[key] = value
    }
    delete json.publishConfig
  }

  return json
}

export function packagePublishConfig(pkg: WorkspacePackage): PackagePublishConfig {
  return { directory: pkg.directory }
}

export async function discoverPublishPackages(root: string): Promise<PackagePublishConfig[]> {
  return (await discoverPublicPackages(root)).map(packagePublishConfig)
}

export async function npmPackFileList(sourceDir: string): Promise<string[]> {
  const listing = await runCommand({
    command: 'npm',
    args: ['pack', '--dry-run', '--json', '--ignore-scripts'],
    cwd: sourceDir,
    timeoutMs: 60_000
  })
  return parseNpmPack(listing.stdout).files
}

export async function preparePublishDirectories(
  options: PreparePublishDirectoriesOptions
): Promise<void> {
  const outRoot = options.outRoot ?? join(options.root, '.publish')
  const listPackageFiles = options.listPackageFiles ?? npmPackFileList
  await rm(outRoot, { recursive: true, force: true })
  await mkdir(outRoot, { recursive: true })

  for (const pkg of options.packages) {
    const sourceDir = join(options.root, pkg.directory)
    const destinationDir = join(outRoot, basename(pkg.directory))
    await mkdir(destinationDir, { recursive: true })

    // npm always packs a root LICENSE, so a package without its own gets the repository's text.
    const hasOwnLicense = existsSync(join(sourceDir, LICENSE_FILE))
    const rootLicense = join(options.root, LICENSE_FILE)
    if (!hasOwnLicense && !existsSync(rootLicense)) {
      throw new Error(`${pkg.directory}: no LICENSE in the package or the repository root`)
    }

    const files = await listPackageFiles(sourceDir)
    for (const relativePath of files) {
      const destination = join(destinationDir, relativePath)
      await mkdir(dirname(destination), { recursive: true })
      await cp(join(sourceDir, relativePath), destination, { dereference: false })
    }

    if (!hasOwnLicense) await cp(rootLicense, join(destinationDir, LICENSE_FILE))

    const packageJSON = await readPackageManifest(join(sourceDir, 'package.json'))
    const publishJSON = publishPackageJSON(packageJSON, options.coreVersion)
    await writeFile(
      join(destinationDir, 'package.json'),
      `${JSON.stringify(publishJSON, null, 2)}\n`
    )
    options.log?.(`Prepared ${destinationDir}`)
  }
}
