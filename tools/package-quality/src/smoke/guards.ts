import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'

import { isEqual } from 'es-toolkit'

import { CommandError, parseNpmPack, runCommand } from '@open-pencil/package-artifacts'
import { inspectTarball, type TarballDiagnostic } from '@open-pencil/package-artifacts/tarball'

import { installPackedPackages } from './install'
import { evaluateRuntime, type RuntimeName } from './runtime'

/** A runtime must import the fixture, or fail with output matching the pattern. */
export type RuntimeExpectation = 'imports' | { failsWith: RegExp }
/** What a runtime did: imported, or failed with this output. */
export type RuntimeObservation = 'imports' | { failed: string }

export interface PackagingGuard {
  /** The `exports["."].bun` target of the fixture manifest. */
  bunTarget: string
  /** Inspector diagnostics the packed fixture must produce, in order. */
  diagnostics: Array<Pick<TarballDiagnostic, 'field' | 'message'>>
  /** Manifest `files` entries; the real `npm pack` decides what they ship. */
  files: string[]
  name: string
  /** Which runtimes must import the installed fixture and how the others must fail. */
  runtimes: Record<RuntimeName, RuntimeExpectation>
}

export interface PackagingGuardObservation {
  diagnostics: Array<Pick<TarballDiagnostic, 'field' | 'message'>>
  runtimes: Record<RuntimeName, RuntimeObservation>
}

const FIXTURE_NAME = '@fixture/resolution'
const FIXTURE_SOURCES: Record<string, string> = {
  'dist/index.js': 'export const ready = true\n',
  'dist/index.d.ts': 'export declare const ready: true\n',
  'src/index.ts': "export { ready } from '#fixture/value'\n",
  'src/value.ts': 'export const ready = true\n'
}
const FIXTURE_IMPORT = `const { ready } = await import(${JSON.stringify(FIXTURE_NAME)}); if (ready !== true) throw new Error('fixture export missing')`
const RUNTIMES = ['node', 'bun'] as const
/** Matches the deadline the release workflow gives `npm pack`. */
const PACK_TIMEOUT_MS = 60_000

/**
 * Broken manifest shapes that the release checks must catch. Each guard packs a
 * fixture with the same `npm pack` the release uses, inspects the tarball, installs
 * it into a consumer, and imports it under Node and Bun. Silence from the inspector
 * on the real packages only means something once these fail the way they should.
 */
export const packagingGuards: PackagingGuard[] = [
  {
    name: 'built entrypoints resolve under Node and Bun',
    files: ['dist'],
    bunTarget: './dist/index.js',
    diagnostics: [],
    runtimes: { node: 'imports', bun: 'imports' }
  },
  {
    name: 'transitive source imports ship with the source directory',
    files: ['dist', 'src'],
    bunTarget: './src/index.ts',
    diagnostics: [],
    runtimes: { node: 'imports', bun: 'imports' }
  },
  {
    name: 'an entrypoint-only file list does not satisfy transitive imports',
    files: ['dist', 'src/index.ts'],
    bunTarget: './src/index.ts',
    diagnostics: [],
    runtimes: { node: 'imports', bun: { failsWith: /Cannot find module '#fixture\/value'/ } }
  },
  {
    name: 'a source-only Bun condition is reported before it breaks consumers',
    files: ['dist'],
    bunTarget: './src/index.ts',
    diagnostics: [{ field: 'exports["."].bun', message: 'target is missing (./src/index.ts)' }],
    runtimes: { node: 'imports', bun: { failsWith: /Cannot find module '@fixture\/resolution'/ } }
  }
]

/** Compare what a guard observed with what it requires; each mismatch is one message. */
export function packagingGuardMismatches(
  guard: PackagingGuard,
  observed: PackagingGuardObservation
): string[] {
  const mismatches: string[] = []
  if (!isEqual(guard.diagnostics, observed.diagnostics)) {
    const describe = (diagnostics: PackagingGuardObservation['diagnostics']) =>
      diagnostics.map(({ field, message }) => `${field} ${message}`).join(', ')
    mismatches.push(
      `${guard.name}: expected diagnostics [${describe(guard.diagnostics)}] but the inspector reported [${describe(observed.diagnostics)}]`
    )
  }
  for (const runtime of RUNTIMES) {
    const mismatch = runtimeMismatch(guard.runtimes[runtime], observed.runtimes[runtime])
    if (mismatch) mismatches.push(`${guard.name}: ${runtime} ${mismatch}`)
  }
  return mismatches
}

function firstLine(output: string): string {
  return output.trim().split('\n')[0] ?? ''
}

function runtimeMismatch(
  expected: RuntimeExpectation,
  observed: RuntimeObservation
): string | undefined {
  if (expected === 'imports') {
    return observed === 'imports'
      ? undefined
      : `should import but failed: ${firstLine(observed.failed)}`
  }
  if (observed === 'imports') return `should fail with ${expected.failsWith} but imported`
  return expected.failsWith.test(observed.failed)
    ? undefined
    : `should fail with ${expected.failsWith} but failed with: ${firstLine(observed.failed)}`
}

function fixtureManifest(guard: PackagingGuard): string {
  return `${JSON.stringify(
    {
      name: FIXTURE_NAME,
      version: '1.0.0',
      type: 'module',
      files: guard.files,
      imports: { '#fixture/*': './src/*.ts' },
      exports: {
        '.': {
          types: './dist/index.d.ts',
          bun: guard.bunTarget,
          import: './dist/index.js',
          default: './dist/index.js'
        }
      }
    },
    null,
    2
  )}\n`
}

async function writeFixture(directory: string, guard: PackagingGuard): Promise<void> {
  const contents = { ...FIXTURE_SOURCES, 'package.json': fixtureManifest(guard) }
  for (const [file, text] of Object.entries(contents)) {
    const path = join(directory, file)
    await mkdir(dirname(path), { recursive: true })
    await writeFile(path, text)
  }
}

async function packFixture(packageDirectory: string, artifacts: string): Promise<string> {
  await mkdir(artifacts, { recursive: true })
  const packed = await runCommand({
    command: 'npm',
    args: ['pack', '--json', '--ignore-scripts', '--pack-destination', artifacts],
    cwd: packageDirectory,
    timeoutMs: PACK_TIMEOUT_MS
  })
  return join(artifacts, parseNpmPack(packed.stdout).filename)
}

async function observeRuntime(runtime: RuntimeName, consumer: string): Promise<RuntimeObservation> {
  try {
    await evaluateRuntime(runtime, FIXTURE_IMPORT, consumer)
    return 'imports'
  } catch (error) {
    if (error instanceof CommandError && !error.timedOut) {
      return { failed: error.stderr.trim() || error.message }
    }
    throw error
  }
}

async function observeGuard(
  root: string,
  guard: PackagingGuard
): Promise<PackagingGuardObservation> {
  const packageDirectory = join(root, 'package')
  await writeFixture(packageDirectory, guard)
  const tarball = await packFixture(packageDirectory, join(root, 'artifacts'))
  const { diagnostics } = await inspectTarball(tarball)
  const consumer = join(root, 'consumer')
  await installPackedPackages(consumer, [tarball])
  return {
    diagnostics: diagnostics.map(({ field, message }) => ({ field, message })),
    runtimes: {
      node: await observeRuntime('node', consumer),
      bun: await observeRuntime('bun', consumer)
    }
  }
}

/** Prove the packaging checks catch broken manifests before trusting them on real packages. */
export async function verifyPackagingGuards(guards = packagingGuards): Promise<void> {
  const root = await mkdtemp(join(tmpdir(), 'open-pencil-packaging-guards-'))
  try {
    const mismatches: string[] = []
    for (const [index, guard] of guards.entries()) {
      const observed = await observeGuard(join(root, String(index)), guard)
      mismatches.push(...packagingGuardMismatches(guard, observed))
    }
    if (mismatches.length > 0) throw new Error(mismatches.join('\n'))
  } finally {
    await rm(root, { recursive: true, force: true })
  }
}
