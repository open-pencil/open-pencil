// Builds a package's Rust crate into a WebAssembly module with Cargo's `wasm` profile, unless the
// sources it was built from are unchanged: the crate, the workspace manifest and lockfile, and
// the pinned toolchain. Their hash is written beside the module, so CI can restore both from a
// cache and skip Cargo.
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises'
import { join, relative } from 'node:path'

import * as v from 'valibot'

import { resolveWorkspaceRoot } from './workspace/root'

const TARGET = 'wasm32-unknown-unknown'

const metadataSchema = v.object({ target_directory: v.string() })

export interface WasmModule {
  /** The package directory, which holds the crate in `crate/` and the module in `wasm/`. */
  packageDir: string
  /** The library Cargo builds, the crate's name with underscores. */
  library: string
  /** The module's file name in `wasm/`. */
  output: string
  /** Cargo features the module is built with. */
  features?: readonly string[]
}

async function cargo(cwd: string, args: string[]): Promise<string> {
  const child = Bun.spawn(['cargo', ...args], { cwd, stdout: 'pipe', stderr: 'inherit' })
  const [stdout, code] = await Promise.all([new Response(child.stdout).text(), child.exited])
  if (code !== 0) throw new Error(`cargo ${args.join(' ')} exited with ${code}`)
  return stdout
}

async function targetDirectory(cwd: string): Promise<string> {
  const text = await cargo(cwd, ['metadata', '--format-version', '1', '--no-deps'])
  const parsed = v.safeParse(v.pipe(v.string(), v.parseJson(), metadataSchema), text)
  if (!parsed.success) throw new Error('cargo metadata returned an unexpected shape')
  return parsed.output.target_directory
}

/**
 * A hash of every file the module is built from, by path relative to the workspace root, and of
 * the features it is built with.
 */
async function sourcesHash(
  root: string,
  packageDir: string,
  features: readonly string[]
): Promise<string> {
  const files = [
    join(root, 'Cargo.toml'),
    join(root, 'Cargo.lock'),
    join(root, 'rust-toolchain.toml'),
    join(packageDir, 'crate', 'Cargo.toml'),
    ...[...new Bun.Glob('crate/src/**/*.rs').scanSync({ cwd: packageDir })].map((file) =>
      join(packageDir, file)
    )
  ]
  // Paths with forward slashes, so a module built on Windows matches its stamp elsewhere.
  const sources = files
    .map((file) => ({ file, name: relative(root, file).replaceAll('\\', '/') }))
    .toSorted((a, b) => a.name.localeCompare(b.name))
  const hasher = new Bun.CryptoHasher('sha256')
  // A module built without features keeps the hash it had before features were hashed.
  if (features.length > 0) hasher.update(`features:${features.toSorted().join(',')}\0`)
  for (const { file, name } of sources) {
    hasher.update(name)
    hasher.update('\0')
    hasher.update(await readFile(file))
    hasher.update('\0')
  }
  return hasher.digest('hex')
}

async function builtHash(output: string, stamp: string): Promise<string | null> {
  try {
    const [hash] = await Promise.all([readFile(stamp, 'utf8'), readFile(output)])
    return hash.trim()
  } catch {
    return null
  }
}

/**
 * Builds the module if it is missing or older than its sources. With `check`, a stale module is
 * an error instead.
 */
export async function buildWasmModule(
  { packageDir, library, output: name, features = [] }: WasmModule,
  { check = false } = {}
): Promise<void> {
  const output = join(packageDir, 'wasm', name)
  const stamp = `${output}.sha256`
  // The Cargo workspace shares the Bun workspace's root, with `Cargo.toml` and `Cargo.lock`.
  const root = await resolveWorkspaceRoot(packageDir)
  const hash = await sourcesHash(root, packageDir, features)
  if ((await builtHash(output, stamp)) === hash) {
    process.stdout.write(`${name} is up to date\n`)
    return
  }
  if (check) {
    throw new Error(`${name} is missing or older than its sources; run bun run build:wasm`)
  }
  if (!Bun.which('cargo')) {
    throw new Error(
      `${name} is missing or older than its sources, and building it needs Rust: ` +
        'install rustup, or build it where Rust is and bring wasm/ along'
    )
  }
  await cargo(packageDir, [
    'build',
    '--profile',
    'wasm',
    '--target',
    TARGET,
    '--manifest-path',
    'crate/Cargo.toml',
    ...(features.length > 0 ? ['--features', features.join(',')] : [])
  ])
  await mkdir(join(packageDir, 'wasm'), { recursive: true })
  const target = await targetDirectory(packageDir)
  await copyFile(join(target, TARGET, 'wasm', `${library}.wasm`), output)
  await writeFile(stamp, `${hash}\n`)
  process.stdout.write(`Built ${relative(root, output)}\n`)
}
