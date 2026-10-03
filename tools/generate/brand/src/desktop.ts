import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { appArtwork, loadArtwork } from './artwork.ts'
import { desktopFiles } from './config.ts'
import { canonicalIcns } from './validate.ts'
import type { BrandFiles } from './web.ts'

export async function generateDesktop(root: string): Promise<BrandFiles> {
  const directory = await mkdtemp(join(tmpdir(), 'open-pencil-icons-'))
  try {
    const { adapter, main } = await loadArtwork(root)
    const source = join(directory, 'app.svg')
    await writeFile(source, appArtwork(main, adapter, 'desktop'))
    // Direct native CLI API: no shell, package download, recursive npm script, or Rust build.
    const { run } = await import('@tauri-apps/cli')
    await run(['icon', source, '--output', join(directory, 'icons')], 'tauri')
    const files: BrandFiles = new Map()
    for (const name of desktopFiles) {
      const bytes = await readFile(join(directory, 'icons', name))
      files.set(name, name.endsWith('.icns') ? canonicalIcns(bytes) : bytes)
    }
    return files
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
}
