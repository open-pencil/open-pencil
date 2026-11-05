// Builds the engine's WebAssembly module into wasm/, unless the sources it was built from are
// unchanged: the crate, the workspace manifest and lockfile, and the pinned toolchain. Their hash
// is written beside the module, so CI can restore both from a cache and skip Cargo.
//   bun scripts/wasm.ts [--check]
import { existsSync } from 'node:fs'
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join, relative } from 'node:path'

import * as v from 'valibot'

const PACKAGE = join(import.meta.dir, '..')
const OUTPUT = join(PACKAGE, 'wasm', 'html-engine.wasm')
const STAMP = `${OUTPUT}.sha256`
const TARGET = 'wasm32-unknown-unknown'

const metadataSchema = v.object({ target_directory: v.string() })

async function cargo(args: string[]): Promise<string> {
  const child = Bun.spawn(['cargo', ...args], { cwd: PACKAGE, stdout: 'pipe', stderr: 'inherit' })
  const [stdout, code] = await Promise.all([new Response(child.stdout).text(), child.exited])
  if (code !== 0) throw new Error(`cargo ${args.join(' ')} exited with ${code}`)
  return stdout
}

/** The Cargo workspace root, found by its lockfile, so a current module needs no Cargo. */
function workspaceRoot(from = PACKAGE): string {
  for (let dir = from; ; dir = dirname(dir)) {
    if (existsSync(join(dir, 'Cargo.lock'))) return dir
    if (dirname(dir) === dir) throw new Error(`No Cargo.lock above ${from}`)
  }
}

async function targetDirectory(): Promise<string> {
  const text = await cargo(['metadata', '--format-version', '1', '--no-deps'])
  const parsed = v.safeParse(v.pipe(v.string(), v.parseJson(), metadataSchema), text)
  if (!parsed.success) throw new Error('cargo metadata returned an unexpected shape')
  return parsed.output.target_directory
}

/** A hash of every file the module is built from, by path relative to the workspace root. */
async function sourcesHash(root: string): Promise<string> {
  const files = [
    join(root, 'Cargo.toml'),
    join(root, 'Cargo.lock'),
    join(PACKAGE, 'rust-toolchain.toml'),
    join(PACKAGE, 'crate', 'Cargo.toml'),
    ...[...new Bun.Glob('crate/src/**/*.rs').scanSync({ cwd: PACKAGE })].map((file) =>
      join(PACKAGE, file)
    )
  ].sort()
  const hasher = new Bun.CryptoHasher('sha256')
  for (const file of files) {
    hasher.update(relative(root, file))
    hasher.update('\0')
    hasher.update(await readFile(file))
    hasher.update('\0')
  }
  return hasher.digest('hex')
}

async function builtHash(): Promise<string | null> {
  try {
    const [stamp] = await Promise.all([readFile(STAMP, 'utf8'), readFile(OUTPUT)])
    return stamp.trim()
  } catch {
    return null
  }
}

const root = workspaceRoot()
const hash = await sourcesHash(root)
if ((await builtHash()) === hash) {
  process.stdout.write('html-engine.wasm is up to date\n')
} else if (process.argv.includes('--check')) {
  throw new Error('html-engine.wasm is missing or older than its sources; run bun run build:wasm')
} else {
  await cargo(['build', '--release', '--target', TARGET, '--manifest-path', 'crate/Cargo.toml'])
  await mkdir(join(PACKAGE, 'wasm'), { recursive: true })
  const target = await targetDirectory()
  await copyFile(join(target, TARGET, 'release', 'open_pencil_html_engine.wasm'), OUTPUT)
  await writeFile(STAMP, `${hash}\n`)
  process.stdout.write(`Built ${relative(root, OUTPUT)}\n`)
}
