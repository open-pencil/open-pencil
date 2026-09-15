import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { cp, mkdir, mkdtemp, readFile, rm, stat, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'

import { fingerprint, isCached } from '#brand/cache'
import { repositoryRoot, targetFiles } from '#brand/config'
import { ensureBrandAssets } from '#brand/generate'

let root: string
beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'open-pencil-brand-test-'))
  for (const path of [
    'assets/brand',
    'tools/brand/src',
    'tools/brand/package.json',
    'package.json',
    'bun.lock'
  ]) {
    await mkdir(dirname(join(root, path)), { recursive: true })
    await cp(join(repositoryRoot, path), join(root, path), { recursive: true })
  }
})
afterEach(async () => {
  await rm(root, { recursive: true, force: true })
})

describe('brand asset preparation', () => {
  test('works from a cold checkout, generates only requested targets, and leaves unrelated files alone', async () => {
    await mkdir(join(root, 'public'))
    await writeFile(join(root, 'public/keep.txt'), 'not owned by the generator')
    await ensureBrandAssets(['web'], { root })
    for (const name of targetFiles('web'))
      expect((await stat(join(root, 'public', name))).isFile()).toBe(true)
    expect(await readFile(join(root, 'public/keep.txt'), 'utf8')).toBe('not owned by the generator')
    await expect(stat(join(root, 'desktop/icons'))).rejects.toThrow()
    await expect(stat(join(root, 'packages/docs/public'))).rejects.toThrow()
  })

  test('warm preparation does not rewrite output; missing/corrupt assets regenerate', async () => {
    await ensureBrandAssets(['docs'], { root })
    const path = join(root, 'packages/docs/public/brand/mark.svg')
    const before = await stat(path)
    const expected = await readFile(path)
    await ensureBrandAssets(['docs'], { root })
    expect((await stat(path)).mtimeMs).toBe(before.mtimeMs)
    await rm(path)
    await ensureBrandAssets(['docs'], { root })
    expect(await readFile(path)).toEqual(expected)
    await writeFile(path, 'corrupt')
    await ensureBrandAssets(['docs'], { root })
    expect(await readFile(path)).toEqual(expected)
  })

  test('source and configuration changes invalidate the cache', async () => {
    await ensureBrandAssets(['web'], { root })
    const before = await fingerprint(root)
    expect(await isCached(root, 'web', before)).toBe(true)
    const source = join(root, 'assets/brand/mark.svg')
    await writeFile(source, `${await readFile(source, 'utf8')}\n`)
    const afterSource = await fingerprint(root)
    expect(afterSource).not.toBe(before)
    expect(await isCached(root, 'web', afterSource)).toBe(false)
    const config = join(root, 'tools/brand/src/config.ts')
    await writeFile(config, `${await readFile(config, 'utf8')}\n`)
    expect(await fingerprint(root)).not.toBe(afterSource)
  })

  test('serializes concurrent preparation', async () => {
    await Promise.all([
      ensureBrandAssets(['web'], { root }),
      ensureBrandAssets(['web', 'docs'], { root })
    ])
    const key = await fingerprint(root)
    expect(await isCached(root, 'web', key)).toBe(true)
    expect(await isCached(root, 'docs', key)).toBe(true)
    expect(await readFile(join(root, 'public/favicon.ico'))).toEqual(
      await readFile(join(root, 'packages/docs/public/favicon.ico'))
    )
  })

  test.skipIf(process.platform === 'win32')(
    'refuses legacy output symlinks without modifying their targets',
    async () => {
      await mkdir(join(root, 'public'))
      const outside = join(root, 'sentinel.ico')
      await writeFile(outside, 'untouched')
      await symlink(outside, join(root, 'public/favicon.ico'))
      await expect(ensureBrandAssets(['web'], { root })).rejects.toThrow('symlink')
      expect(await readFile(outside, 'utf8')).toBe('untouched')
      await expect(stat(join(root, 'public/brand/mark.svg'))).rejects.toThrow()
    }
  )
})
