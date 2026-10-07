import { execFile } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'

import { lock } from 'proper-lockfile'

import { resolveWorkspaceRoot } from '@open-pencil/package-artifacts-tools/workspace'

/** Where the app serves the demo from, relative to the repository root. */
const DEMO_OUTPUT = 'public/demo.fig'
const CACHE = '.cache/demo'

/** Everything the demo's bytes depend on: its own sources and the engine that writes them. */
const INPUT_DIRECTORIES = [
  'tools/generate/demo/src',
  'packages/scene-graph/src',
  'packages/core/src',
  'packages/design-jsx/src',
  'packages/dom-css/src',
  'packages/emit/src',
  'packages/fig/src',
  'packages/kiwi/src'
]
const INPUT_FILES = ['tools/generate/demo/package.json', 'package.json', 'bun.lock']

async function filesIn(root: string, directory: string): Promise<string[]> {
  const result: string[] = []
  for (const item of await readdir(join(root, directory), { withFileTypes: true })) {
    const path = join(directory, item.name)
    if (item.isDirectory()) result.push(...(await filesIn(root, path)))
    else if (item.isFile()) result.push(path)
  }
  return result
}

async function fingerprint(root: string): Promise<string> {
  const listed = await Promise.all(INPUT_DIRECTORIES.map((directory) => filesIn(root, directory)))
  const paths = [...listed.flat(), ...INPUT_FILES].sort()
  const hash = createHash('sha256')
  for (const path of paths)
    hash
      .update(path)
      .update('\0')
      .update(await readFile(join(root, path)))
      .update('\0')
  return hash.digest('hex')
}

const digest = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex')

/** Whether the output is the one built from these inputs and nobody replaced it since. */
async function isCurrent(root: string, key: string): Promise<boolean> {
  try {
    const [recorded, output] = await Promise.all([
      readFile(join(root, CACHE, 'fingerprint'), 'utf8'),
      readFile(join(root, DEMO_OUTPUT))
    ])
    return recorded === `${key}\n${digest(output)}`
  } catch {
    return false
  }
}

/**
 * Build `public/demo.fig` unless the one there was built from the current sources. Build-time
 * only: Vite's config calls it before serving or bundling, and `generate:demo` forces it.
 */
export async function ensureDemoDocument(options: { root?: string; force?: boolean } = {}) {
  const root = options.root ?? (await resolveWorkspaceRoot(fileURLToPath(import.meta.url)))
  const cache = join(root, CACHE)
  await mkdir(cache, { recursive: true })
  // Dev, Storybook, and Playwright servers may start together; one of them builds.
  const release = await lock(cache, {
    realpath: false,
    retries: { retries: 120, minTimeout: 100, maxTimeout: 1000, randomize: false }
  })
  try {
    const key = await fingerprint(root)
    if (!options.force && (await isCurrent(root, key))) return
    // Vite loads this module in Node; the build runs in Bun, like the repository's other
    // tools, and only when the sources changed, so a cached start never loads the engine.
    const output = join(root, DEMO_OUTPUT)
    await promisify(execFile)(
      'bun',
      [fileURLToPath(new URL('write.ts', import.meta.url)), output],
      {
        cwd: root
      }
    )
    await writeFile(join(cache, 'fingerprint'), `${key}\n${digest(await readFile(output))}`)
    console.info('Generated the demo document')
  } finally {
    await release()
  }
}
