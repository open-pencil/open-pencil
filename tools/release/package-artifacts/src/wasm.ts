// Builds a package's Rust crate into a WebAssembly module with Cargo's `wasm` profile, then
// shrinks it with Binaryen, unless the sources it was built from are unchanged: the crate, the
// workspace manifest and lockfile, the pinned toolchain, and how it is optimized. Their hash is
// written beside the module, so CI can restore both from a cache and skip Cargo.
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

import binaryen from 'binaryen'
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
  /**
   * The exports its host calls; the others, such as wasm-bindgen's helpers in a crate's
   * dependencies, are removed with the code only they reach. Every export is kept without it.
   */
  exports?: readonly string[]
}

/**
 * The WebAssembly features rustc enables for `wasm32-unknown-unknown`, which Binaryen keeps the
 * module to: it may use these and no others.
 */
const RUSTC_FEATURES =
  binaryen.Features.MutableGlobals |
  binaryen.Features.NontrappingFPToInt |
  binaryen.Features.BulkMemory |
  binaryen.Features.BulkMemoryOpt |
  binaryen.Features.SignExt |
  binaryen.Features.ReferenceTypes |
  binaryen.Features.Multivalue |
  binaryen.Features.CallIndirectOverlong

const binaryenPackageSchema = v.object({ version: v.string() })

/**
 * How modules are optimized, for the sources hash: the Binaryen release and this file, which
 * holds every setting `optimized` applies.
 */
async function optimizer(): Promise<string> {
  const manifest = join(dirname(fileURLToPath(import.meta.resolve('binaryen'))), 'package.json')
  const parsed = v.safeParse(
    v.pipe(v.string(), v.parseJson(), binaryenPackageSchema),
    await readFile(manifest, 'utf8')
  )
  if (!parsed.success) throw new Error('binaryen has no version')
  const settings = new Bun.CryptoHasher('sha256')
    .update(await readFile(fileURLToPath(import.meta.url)))
    .digest('hex')
  return `binaryen ${parsed.output.version} ${settings}`
}

/** Reads one unsigned LEB128 number from `bytes` at `at`. */
function leb(bytes: Uint8Array, at: number): { value: number; next: number } {
  let value = 0
  let shift = 0
  let next = at
  for (;;) {
    const byte = bytes[next++]
    if (byte === undefined) throw new Error('A WebAssembly section header ends early')
    value += (byte & 0x7f) * 2 ** shift
    if (byte < 0x80) return { value, next }
    shift += 7
  }
}

/**
 * The module without its custom sections: names, producers, and data only a binding generator
 * reads, such as wasm-bindgen's, which the host never runs.
 */
function withoutCustomSections(bytes: Uint8Array): Uint8Array {
  const kept: Uint8Array[] = [bytes.subarray(0, 8)]
  let at = 8
  while (at < bytes.length) {
    const id = bytes[at]
    const { value: size, next } = leb(bytes, at + 1)
    const end = next + size
    if (end > bytes.length) throw new Error('A WebAssembly section runs past the module')
    if (id !== 0) kept.push(bytes.subarray(at, end))
    at = end
  }
  const result = new Uint8Array(kept.reduce((total, part) => total + part.length, 0))
  let offset = 0
  for (const part of kept) {
    result.set(part, offset)
    offset += part.length
  }
  return result
}

/**
 * The module as Binaryen shrinks it for size (`wasm-opt -Oz`), keeping only `exports`, without
 * inlining: copies of small functions shrink a module but leave it larger once compressed, as a
 * browser downloads it (fig's grew from 478 to 628 KB with gzip).
 */
function optimized(module: Uint8Array, exports: readonly string[] | undefined): Uint8Array {
  const wasm = binaryen.readBinary(withoutCustomSections(module))
  try {
    // Optimizations may then use only what the module could already use.
    wasm.setFeatures(RUSTC_FEATURES)
    if (!wasm.validate())
      throw new Error('The module uses WebAssembly features rustc does not enable')
    if (exports) {
      const names = Array.from(
        { length: wasm.getNumExports() },
        (_, at) => binaryen.getExportInfo(wasm.getExportByIndex(at)).name
      )
      const missing = exports.filter((name) => !names.includes(name))
      if (missing.length) throw new Error(`The module does not export ${missing.join(', ')}`)
      for (const name of names) if (!exports.includes(name)) wasm.removeExport(name)
    }
    binaryen.setOptimizeLevel(2)
    binaryen.setShrinkLevel(2)
    binaryen.setDebugInfo(false)
    binaryen.setAlwaysInlineMaxSize(0)
    binaryen.setFlexibleInlineMaxSize(0)
    binaryen.setOneCallerInlineMaxSize(0)
    wasm.optimize()
    if (!wasm.validate()) throw new Error('Binaryen produced an invalid module')
    return wasm.emitBinary()
  } finally {
    wasm.dispose()
  }
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
 * how it is built: its features, its exports, and the optimizer.
 */
async function sourcesHash(
  root: string,
  packageDir: string,
  features: readonly string[],
  exports: readonly string[] | undefined
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
  hasher.update(`features:${features.toSorted().join(',')}\0`)
  hasher.update(`exports:${exports ? exports.toSorted().join(',') : '*'}\0`)
  hasher.update(`${await optimizer()}\0`)
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
  { packageDir, library, output: name, features = [], exports }: WasmModule,
  { check = false } = {}
): Promise<void> {
  const output = join(packageDir, 'wasm', name)
  const stamp = `${output}.sha256`
  // The Cargo workspace shares the Bun workspace's root, with `Cargo.toml` and `Cargo.lock`.
  const root = await resolveWorkspaceRoot(packageDir)
  const hash = await sourcesHash(root, packageDir, features, exports)
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
  const built = await readFile(join(target, TARGET, 'wasm', `${library}.wasm`))
  await writeFile(output, optimized(new Uint8Array(built), exports))
  await writeFile(stamp, `${hash}\n`)
  process.stdout.write(`Built ${relative(root, output)}\n`)
}
