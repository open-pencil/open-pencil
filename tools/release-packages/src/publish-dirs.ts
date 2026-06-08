import { copyFile, mkdir, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { basename, dirname, join } from 'node:path'

interface PackagePublishConfig {
  dir: string
  extraFiles: string[]
  include: string[]
}

interface PreparePublishDirectoriesOptions {
  coreVersion: string
  packages: PackagePublishConfig[]
  root: string
  outRoot?: string
  log?: (message: string) => void
}

type PackageJSON = Record<string, unknown> & {
  dependencies?: Record<string, string>
  devDependencies?: Record<string, string>
  peerDependencies?: Record<string, string>
  publishConfig?: Record<string, unknown>
  scripts?: unknown
}

const PACKAGE_FIELDS = ['dependencies', 'devDependencies', 'peerDependencies'] as const
const PUBLISH_CONFIG_FIELDS = new Set(['access', 'provenance', 'registry'])

export const DEFAULT_PACKAGES: PackagePublishConfig[] = [
  { dir: 'packages/core', include: ['dist', 'src', 'assets'], extraFiles: [] },
  { dir: 'packages/cli', include: ['bin', 'dist'], extraFiles: [] },
  { dir: 'packages/mcp', include: ['dist'], extraFiles: [] },
  { dir: 'packages/vue', include: ['dist'], extraFiles: ['README.md'] }
]

async function exists(path: string) {
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

export function publishPackageJSON(source: PackageJSON, coreVersion: string): PackageJSON {
  const json = structuredClone(source)

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

export async function preparePublishDirectories(
  options: PreparePublishDirectoriesOptions
): Promise<void> {
  const outRoot = options.outRoot ?? join(options.root, '.publish')
  const log = options.log

  await rm(outRoot, { recursive: true, force: true })
  await mkdir(outRoot, { recursive: true })

  for (const pkg of options.packages) {
    const sourceDir = join(options.root, pkg.dir)
    const destinationDir = join(outRoot, basename(pkg.dir))
    await mkdir(destinationDir, { recursive: true })

    for (const relativePath of pkg.include) {
      const from = join(sourceDir, relativePath)
      if (await exists(from)) await copyRecursive(from, join(destinationDir, relativePath))
    }

    for (const relativePath of pkg.extraFiles) {
      const from = join(sourceDir, relativePath)
      if (await exists(from)) await copyRecursive(from, join(destinationDir, relativePath))
    }

    const packageJSON = JSON.parse(
      await readFile(join(sourceDir, 'package.json'), 'utf8')
    ) as PackageJSON
    const publishJSON = publishPackageJSON(packageJSON, options.coreVersion)
    await writeFile(
      join(destinationDir, 'package.json'),
      `${JSON.stringify(publishJSON, null, 2)}\n`
    )
    log?.(`Prepared ${destinationDir}`)
  }
}
