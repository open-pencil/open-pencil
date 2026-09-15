import { createHash } from 'node:crypto'
import { lstat, mkdir, readFile, readdir, rename, writeFile } from 'node:fs/promises'
import { dirname, join, relative, sep } from 'node:path'

import sharp from 'sharp'
import * as v from 'valibot'

import { targetDirectory, targetFiles } from './config.ts'
import type { BrandTarget } from './config.ts'
import type { BrandFiles } from './web.ts'

export const digest = (bytes: string | Buffer) => createHash('sha256').update(bytes).digest('hex')

const cacheSchema = v.object({ fingerprint: v.string(), outputs: v.record(v.string(), v.string()) })

async function inputFiles(root: string, directory: string): Promise<string[]> {
  const result: string[] = []
  for (const item of await readdir(join(root, directory), { withFileTypes: true })) {
    const path = join(directory, item.name)
    if (item.isDirectory()) result.push(...(await inputFiles(root, path)))
    else if (item.isFile() && !item.name.endsWith('.md')) result.push(path)
  }
  return result.sort()
}

export async function fingerprint(root: string): Promise<string> {
  const paths = [
    ...(await inputFiles(root, 'assets/brand')),
    ...(await inputFiles(root, 'tools/brand/src')),
    'tools/brand/package.json',
    'package.json',
    'bun.lock'
  ]
  const hash = createHash('sha256')
  for (const path of paths)
    hash
      .update(path)
      .update('\0')
      .update(await readFile(join(root, path)))
      .update('\0')
  hash.update(
    JSON.stringify({
      platform: process.platform,
      arch: process.arch,
      runtime: process.versions,
      sharp: sharp.versions
    })
  )
  return hash.digest('hex')
}

export async function isCached(root: string, target: BrandTarget, key: string): Promise<boolean> {
  try {
    const cache = v.parse(
      cacheSchema,
      JSON.parse(await readFile(join(root, '.cache/brand', `${target}.json`), 'utf8'))
    )
    if (cache.fingerprint !== key) return false
    for (const name of targetFiles(target)) {
      const path = join(root, targetDirectory(target), name)
      if (!(await lstat(path)).isFile() || digest(await readFile(path)) !== cache.outputs[name])
        return false
    }
    return true
  } catch {
    return false
  }
}

/** Refuse directory/file symlinks rather than following legacy web -> desktop links. */
export async function assertOwnedPath(root: string, path: string): Promise<void> {
  const rel = relative(root, path)
  if (rel.startsWith('..') || rel.startsWith(sep))
    throw new Error(`Output escapes brand root: ${path}`)
  let current = root
  for (const part of rel.split(sep)) {
    current = join(current, part)
    try {
      if ((await lstat(current)).isSymbolicLink())
        throw new Error(`Refusing brand output symlink: ${current}`)
    } catch (error) {
      if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) throw error
    }
  }
}

async function atomicWrite(root: string, path: string, bytes: string | Buffer): Promise<void> {
  await assertOwnedPath(root, path)
  await mkdir(dirname(path), { recursive: true })
  const temp = `${path}.tmp`
  await assertOwnedPath(root, temp)
  await writeFile(temp, bytes)
  await rename(temp, path)
}

export async function publish(
  root: string,
  target: BrandTarget,
  key: string,
  files: BrandFiles
): Promise<void> {
  const outputs: Record<string, string> = {}
  const names = targetFiles(target)
  // Preflight all destinations before writing anything. Only explicitly owned files are touched.
  for (const name of names) await assertOwnedPath(root, join(root, targetDirectory(target), name))
  for (const name of names) {
    const bytes = files.get(name)
    if (!bytes) throw new Error(`Generator did not produce ${name}`)
    await atomicWrite(root, join(root, targetDirectory(target), name), bytes)
    outputs[name] = digest(bytes)
  }
  // Publish the cache last. An interrupted generation is rebuilt on the next run.
  await atomicWrite(
    root,
    join(root, '.cache/brand', `${target}.json`),
    JSON.stringify({ fingerprint: key, outputs })
  )
}
