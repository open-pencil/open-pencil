import { expect, test } from 'bun:test'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { stampNightlyVersion } from '#release/nightly/stamp'

test('writes the nightly version where the editor and the bundles read it, keeping the rest', async () => {
  const root = await mkdtemp(join(tmpdir(), 'nightly-stamp-'))
  try {
    await mkdir(join(root, 'desktop'))
    await writeFile(
      join(root, 'package.json'),
      JSON.stringify({ name: 'open-pencil', version: '0.17.0-beta.5' })
    )
    await writeFile(
      join(root, 'desktop/tauri.conf.json'),
      JSON.stringify({ productName: 'OpenPencil', version: '0.17.0-beta.5' })
    )
    await stampNightlyVersion(root, '0.17.0-nightly.20261116')
    expect(JSON.parse(await readFile(join(root, 'package.json'), 'utf8'))).toEqual({
      name: 'open-pencil',
      version: '0.17.0-nightly.20261116'
    })
    expect(JSON.parse(await readFile(join(root, 'desktop/tauri.conf.json'), 'utf8'))).toEqual({
      productName: 'OpenPencil',
      version: '0.17.0-nightly.20261116'
    })
    await expect(stampNightlyVersion(root, '0.17.0')).rejects.toThrow()
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})
