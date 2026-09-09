import { copyFile, mkdir, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { basename, dirname, join } from 'node:path'

import {
  discoverPublicPackages,
  type PackageManifest,
  type WorkspacePackage
} from '@open-pencil/package-artifacts'

export interface PackagePublishConfig {
  directory: string
  include: string[]
}

export interface PreparePublishDirectoriesOptions {
  coreVersion: string
  packages: PackagePublishConfig[]
  root: string
  outRoot?: string
  log?: (message: string) => void
}

const PACKAGE_FIELDS = [
  'dependencies',
  'devDependencies',
  'peerDependencies',
  'optionalDependencies'
] as const satisfies ReadonlyArray<keyof PackageManifest>
const PUBLISH_CONFIG_FIELDS = new Set(['access', 'provenance', 'registry'])

async function exists(path: string): Promise<boolean> {
  try {
    await stat(path)
    return true
  } catch {
    return false
  }
}

async function copyRecursive(from: string, to: string): Promise<void> {
  const sourceStat = await stat(from)
  if (sourceStat.isDirectory()) {
    await mkdir(to, { recursive: true })
    for (const entry of await readdir(from)) {
      await copyRecursive(join(from, entry), join(to, entry))
    }
    return
  }
  await mkdir(dirname(to), { recursive: true })
  await copyFile(from, to)
}

export function publishPackageJSON(source: PackageManifest, coreVersion: string): PackageManifest {
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
    if (!dependencies || typeof dependencies !== 'object' || Array.isArray(dependencies)) continue
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
  const include = new Set(pkg.manifest.files)
  const binTargets =
    typeof pkg.manifest.bin === 'string'
      ? [pkg.manifest.bin]
      : Object.values(pkg.manifest.bin ?? {})
  for (const target of binTargets) {
    const topLevel = target.replace(/^\.\//, '').split('/')[0]
    if (topLevel) include.add(topLevel)
  }
  return { directory: pkg.directory, include: [...include] }
}

export async function discoverPublishPackages(root: string): Promise<PackagePublishConfig[]> {
  return (await discoverPublicPackages(root)).map(packagePublishConfig)
}

export async function preparePublishDirectories(
  options: PreparePublishDirectoriesOptions
): Promise<void> {
  const outRoot = options.outRoot ?? join(options.root, '.publish')
  await rm(outRoot, { recursive: true, force: true })
  await mkdir(outRoot, { recursive: true })

  for (const pkg of options.packages) {
    const sourceDir = join(options.root, pkg.directory)
    const destinationDir = join(outRoot, basename(pkg.directory))
    await mkdir(destinationDir, { recursive: true })

    for (const relativePath of pkg.include) {
      const from = join(sourceDir, relativePath)
      if (await exists(from)) await copyRecursive(from, join(destinationDir, relativePath))
    }

    const packageJSON = JSON.parse(
      await readFile(join(sourceDir, 'package.json'), 'utf8')
    ) as PackageManifest
    const publishJSON = publishPackageJSON(packageJSON, options.coreVersion)
    await writeFile(
      join(destinationDir, 'package.json'),
      `${JSON.stringify(publishJSON, null, 2)}\n`
    )
    options.log?.(`Prepared ${destinationDir}`)
  }
}
