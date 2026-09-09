import { cp, mkdir, rm, writeFile } from 'node:fs/promises'
import { basename, dirname, join } from 'node:path'

import {
  discoverPublicPackages,
  readPackageManifest,
  runCommand,
  type PackageManifest,
  type WorkspacePackage
} from '@open-pencil/package-artifacts'

export interface PackagePublishConfig {
  directory: string
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
  return { directory: pkg.directory }
}

export async function discoverPublishPackages(root: string): Promise<PackagePublishConfig[]> {
  return (await discoverPublicPackages(root)).map(packagePublishConfig)
}

function npmPackFiles(stdout: string): string[] {
  const data: unknown = JSON.parse(stdout)
  if (
    !Array.isArray(data) ||
    data.length !== 1 ||
    !data[0] ||
    typeof data[0] !== 'object' ||
    !('files' in data[0]) ||
    !Array.isArray(data[0].files)
  ) {
    throw new Error('npm pack did not return a file listing')
  }
  return data[0].files.map((entry: unknown) => {
    if (
      !entry ||
      typeof entry !== 'object' ||
      !('path' in entry) ||
      typeof entry.path !== 'string' ||
      entry.path.startsWith('/') ||
      entry.path.includes('\\') ||
      entry.path.split('/').includes('..')
    ) {
      throw new Error('npm pack returned an invalid file path')
    }
    return entry.path
  })
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

    const listing = await runCommand({
      command: 'npm',
      args: ['pack', '--dry-run', '--json', '--ignore-scripts'],
      cwd: sourceDir,
      timeoutMs: 60_000
    })
    const files = npmPackFiles(listing.stdout)
    for (const relativePath of files) {
      const destination = join(destinationDir, relativePath)
      await mkdir(dirname(destination), { recursive: true })
      await cp(join(sourceDir, relativePath), destination, { dereference: false })
    }

    const packageJSON = await readPackageManifest(join(sourceDir, 'package.json'))
    const publishJSON = publishPackageJSON(packageJSON, options.coreVersion)
    await writeFile(
      join(destinationDir, 'package.json'),
      `${JSON.stringify(publishJSON, null, 2)}\n`
    )
    options.log?.(`Prepared ${destinationDir}`)
  }
}
