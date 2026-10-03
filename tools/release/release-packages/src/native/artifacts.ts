import { realpath, stat } from 'node:fs/promises'
import { basename, isAbsolute, relative, resolve, sep } from 'node:path'

import * as v from 'valibot'

import type { DesktopAsset } from './catalog.ts'

export interface ReportedAsset {
  source: string
  name: string
}

/** Consume tauri-action's artifactPaths output, never search for plausible build files. */
export async function resolveReportedAssets(
  input: unknown,
  expected: readonly DesktopAsset[],
  root: string
): Promise<ReportedAsset[]> {
  const paths = v.parse(v.array(v.string()), input)
  const sourceRoot = await realpath(root)
  const wanted = new Map<string, string>()

  for (const asset of expected) {
    wanted.set(asset.source, asset.name)

    if (asset.signed) wanted.set(`${asset.source}.sig`, `${asset.name}.sig`)
  }

  const found = new Map<string, ReportedAsset>()

  for (const path of paths) {
    const source = await realpath(resolve(sourceRoot, path))
    const local = relative(sourceRoot, source)

    if (isAbsolute(local) || local === '..' || local.startsWith(`..${sep}`)) {
      throw new Error('Reported artifact escapes source checkout')
    }

    const info = await stat(source)
    // tauri-action also reports the macOS .app directory. Its signed archive is required below.
    if (info.isDirectory() && source.endsWith('.app')) continue
    if (!info.isFile()) throw new Error(`Not an artifact file: ${path}`)

    const name = wanted.get(basename(source))
    if (!name) throw new Error(`Unexpected reported artifact: ${path}`)
    if (found.has(name)) throw new Error(`Duplicate reported artifact: ${name}`)
    if (info.size === 0) throw new Error(`Empty reported artifact: ${name}`)

    found.set(name, { source, name })
  }

  const missing = [...wanted.values()].filter((name) => !found.has(name))
  if (missing.length > 0) throw new Error(`Missing reported artifacts: ${missing.join(', ')}`)

  return [...found.values()]
}
