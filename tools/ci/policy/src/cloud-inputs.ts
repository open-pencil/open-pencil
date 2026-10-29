import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

// The classify job runs before dependencies are installed, so this module uses only Node and Bun.

const CLOUD_PACKAGE = 'packages/cloud'

/** Files every suite depends on: dependency resolution, scripts, test runner setup, and CI itself. */
const SHARED_INPUTS = [
  'package.json',
  'bun.lock',
  'bunfig.toml',
  '.github/workflows/ci.yml',
  '.github/actions/',
  'tools/ci/'
]

type Manifest = { name?: string; workspaces: string[]; workspaceDependencies: string[] }

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item) => typeof item === 'string') : []
}

/** Names of the packages a manifest takes from the workspace (`workspace:` versions). */
function workspaceNames(...groups: unknown[]): string[] {
  return groups.flatMap((group) =>
    isRecord(group)
      ? Object.entries(group)
          .filter(([, version]) => typeof version === 'string' && version.startsWith('workspace:'))
          .map(([name]) => name)
      : []
  )
}

async function readManifest(root: string, directory: string): Promise<Manifest> {
  const parsed: unknown = JSON.parse(await readFile(join(root, directory, 'package.json'), 'utf8'))
  if (!isRecord(parsed)) throw new Error(`${directory}/package.json is not an object`)
  return {
    name: typeof parsed.name === 'string' ? parsed.name : undefined,
    workspaces: strings(parsed.workspaces),
    workspaceDependencies: workspaceNames(parsed.dependencies, parsed.devDependencies)
  }
}

async function testPreloads(root: string): Promise<string[]> {
  const bunfig: unknown = Bun.TOML.parse(await readFile(join(root, 'bunfig.toml'), 'utf8'))
  const test = isRecord(bunfig) ? bunfig.test : undefined
  return strings(isRecord(test) ? test.preload : undefined).map((path) => path.replace(/^\.\//, ''))
}

/**
 * What the Cloud suites are built from: the Cloud package, every workspace package it depends on,
 * directly or through another, the files every suite shares, and the test preloads in `bunfig.toml`.
 */
export async function cloudInputs(root: string): Promise<string[]> {
  const directories = new Map<string, string>()
  for (const directory of (await readManifest(root, '.')).workspaces) {
    const { name } = await readManifest(root, directory)
    if (name) directories.set(name, directory)
  }
  const reached = new Set([CLOUD_PACKAGE])
  const pending = [CLOUD_PACKAGE]
  for (let directory = pending.pop(); directory; directory = pending.pop()) {
    for (const name of (await readManifest(root, directory)).workspaceDependencies) {
      const dependency = directories.get(name)
      if (dependency && !reached.has(dependency)) {
        reached.add(dependency)
        pending.push(dependency)
      }
    }
  }
  const directoriesReached = [...reached].map((directory) => `${directory}/`)
  return [...directoriesReached, ...SHARED_INPUTS, ...(await testPreloads(root))]
}
