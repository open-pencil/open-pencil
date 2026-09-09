import { mkdir, readdir, rm } from 'node:fs/promises'
import { basename, join } from 'node:path'

import {
  buildPublicPackages,
  CommandError,
  discoverPublicPackages,
  orderPackagesByDependencies,
  parseNpmPack,
  isRegistryNotFound,
  validateRegistryVersion,
  readPackageManifest,
  runCommand,
  type WorkspacePackage
} from '@open-pencil/package-artifacts'
import { inspectTarball, validatePackedTarballs } from '@open-pencil/package-artifacts/tarball'
import { verifyArtifactConsumers } from '@open-pencil/package-quality-tools/consumer'

import { NPM_RELEASE_POLICY } from './policy'
import { discoverPublishPackages, preparePublishDirectories } from './publish-dirs'

export interface PublicationPlanEntry {
  package: WorkspacePackage
  status: 'published' | 'unpublished'
}

export type PackagePublicationLookup = (pkg: WorkspacePackage) => Promise<boolean>

export interface ReleasePaths {
  artifacts: string
  prepared: string
  root: string
}

export function releasePaths(root: string): ReleasePaths {
  return {
    root,
    artifacts: join(root, '.npm-packages'),
    prepared: join(root, '.publish')
  }
}

export { buildPublicPackages as buildReleasePackages }

export async function prepareReleasePackages(root: string): Promise<void> {
  const packages = await discoverPublicPackages(root)
  const { version } = await readPackageManifest(join(root, 'package.json'))
  if (packages.length === 0) throw new Error('No public packages discovered')
  if (packages.some(({ manifest }) => manifest.version !== version)) {
    throw new Error('Public package versions must be aligned before release preparation')
  }
  await preparePublishDirectories({
    coreVersion: version,
    packages: await discoverPublishPackages(root),
    root,
    log: console.log
  })
}

async function packageIsPublished(pkg: WorkspacePackage, root: string): Promise<boolean> {
  const specifier = `${pkg.manifest.name}@${pkg.manifest.version}`
  try {
    const result = await runCommand({
      command: 'npm',
      args: ['view', specifier, 'version', '--json', '--registry', NPM_RELEASE_POLICY.registry],
      cwd: root,
      timeoutMs: 30_000
    })
    validateRegistryVersion(result.stdout, pkg.manifest.version)
    return true
  } catch (error) {
    if (error instanceof CommandError && isRegistryNotFound(error.stdout)) return false
    throw error
  }
}

export async function createPublicationPlan(
  root: string,
  isPublished: PackagePublicationLookup = (pkg) => packageIsPublished(pkg, root)
): Promise<PublicationPlanEntry[]> {
  const packages = orderPackagesByDependencies(await discoverPublicPackages(root))
  const statuses = await Promise.all(packages.map(isPublished))
  return packages.map((pkg, index) => ({
    package: pkg,
    status: statuses[index] ? 'published' : 'unpublished'
  }))
}

export async function packReleasePackages(
  root: string,
  isPublished?: PackagePublicationLookup
): Promise<PublicationPlanEntry[]> {
  const paths = releasePaths(root)
  const plan = await createPublicationPlan(root, isPublished)
  await rm(paths.artifacts, { recursive: true, force: true })
  await mkdir(paths.artifacts, { recursive: true })

  for (const entry of plan) {
    const { manifest } = entry.package
    const preparedDirectory = join(paths.prepared, basename(entry.package.directory))
    const result = await runCommand({
      command: 'npm',
      args: ['pack', '--json', '--pack-destination', paths.artifacts],
      cwd: preparedDirectory,
      timeoutMs: 60_000
    })
    console.log(`Packed ${manifest.name}: ${parseNpmPack(result.stdout).filename}`)
  }

  await validatePackedTarballs(paths.artifacts)
  return plan
}

async function artifactsByPackage(directory: string): Promise<Map<string, string>> {
  const artifacts = new Map<string, string>()
  for (const filename of (await readdir(directory)).filter((name) => name.endsWith('.tgz'))) {
    const path = join(directory, filename)
    const { manifest, diagnostics } = await inspectTarball(path)
    if (diagnostics.length > 0) {
      throw new Error(
        diagnostics
          .map(({ packageName, field, message }) => `${packageName}: ${field} ${message}`)
          .join('\n')
      )
    }
    const key = `${manifest.name}@${manifest.version}`
    if (artifacts.has(key)) throw new Error(`Duplicate package artifact for ${key}`)
    artifacts.set(key, path)
  }
  return artifacts
}

export function validatePublicationArtifacts(
  plan: PublicationPlanEntry[],
  artifacts: Map<string, string>
): void {
  const expected = new Set(
    plan
      .filter(({ status }) => status === 'unpublished')
      .map(({ package: pkg }) => `${pkg.manifest.name}@${pkg.manifest.version}`)
  )
  const missing = [...expected].filter((key) => !artifacts.has(key))
  const known = new Set(
    plan.map(({ package: pkg }) => `${pkg.manifest.name}@${pkg.manifest.version}`)
  )
  const unexpected = [...artifacts.keys()].filter((key) => !known.has(key))
  if (missing.length === 0 && unexpected.length === 0) return

  const messages = [
    ...missing.map((key) => `Missing verified package artifact for ${key}`),
    ...unexpected.map((key) => `Unexpected package artifact for ${key}`)
  ]
  throw new Error(messages.join('\n'))
}

export interface PublicationOperations {
  plan(root: string): Promise<PublicationPlanEntry[]>
  artifacts(directory: string): Promise<Map<string, string>>
  verify(root: string, tarballs: string[]): Promise<void>
  execute: typeof runCommand
}

const publicationOperations: PublicationOperations = {
  plan: createPublicationPlan,
  artifacts: artifactsByPackage,
  verify: verifyArtifactConsumers,
  execute: runCommand
}

export async function publishReleasePackages(
  root: string,
  operations: PublicationOperations = publicationOperations
): Promise<PublicationPlanEntry[]> {
  const paths = releasePaths(root)
  const plan = await operations.plan(root)
  const artifacts = await operations.artifacts(paths.artifacts)
  validatePublicationArtifacts(plan, artifacts)
  await operations.verify(root, [...artifacts.values()])

  for (const entry of plan) {
    const { manifest } = entry.package
    if (entry.status === 'published') {
      console.log(`Skipping ${manifest.name}@${manifest.version}: already published`)
      continue
    }
    const key = `${manifest.name}@${manifest.version}`
    const artifact = artifacts.get(key)
    if (!artifact) throw new Error(`Publication artifact disappeared for ${key}`)
    await operations.execute({
      command: 'npm',
      args: [
        'publish',
        artifact,
        '--access',
        NPM_RELEASE_POLICY.access,
        '--provenance',
        '--registry',
        NPM_RELEASE_POLICY.registry
      ],
      cwd: root,
      output: 'inherit',
      timeoutMs: 120_000
    })
  }
  return plan
}
