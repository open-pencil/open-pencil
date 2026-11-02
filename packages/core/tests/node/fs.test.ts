import { describe, expect, test } from 'bun:test'
import { chmod, lstat, mkdtemp, readdir, readFile, stat, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { writeFileAtomic } from '@open-pencil/core/node/fs'

async function scratch() {
  return mkdtemp(join(tmpdir(), 'open-pencil-atomic-'))
}

describe('writeFileAtomic', () => {
  test('replaces a file, keeping its mode and leaving nothing beside it', async () => {
    const dir = await scratch()
    const path = join(dir, 'doc.json')
    await writeFile(path, 'old')
    await chmod(path, 0o640)

    await writeFileAtomic(path, 'new')

    expect(await readFile(path, 'utf8')).toBe('new')
    expect((await stat(path)).mode & 0o777).toBe(0o640)
    expect(await readdir(dir)).toEqual(['doc.json'])
  })

  test('gives a new file the mode it is asked for', async () => {
    const dir = await scratch()
    const path = join(dir, 'token.json')

    await writeFileAtomic(path, new TextEncoder().encode('{}'), { mode: 0o600 })

    expect(await readFile(path, 'utf8')).toBe('{}')
    expect((await stat(path)).mode & 0o777).toBe(0o600)
  })

  test('writes a document through a symlink to the file it points at when asked', async () => {
    const dir = await scratch()
    const target = join(dir, 'real.fig')
    const link = join(dir, 'link.fig')
    await writeFile(target, 'old')
    await symlink(target, link)

    await writeFileAtomic(link, 'new', { symlink: 'follow' })

    expect((await lstat(link)).isSymbolicLink()).toBe(true)
    expect(await readFile(target, 'utf8')).toBe('new')
  })

  test('replaces a symlink by default, leaving the file it pointed at', async () => {
    const dir = await scratch()
    const target = join(dir, 'elsewhere')
    const link = join(dir, 'discovery.json')
    await writeFile(target, 'untouched')
    await symlink(target, link)

    await writeFileAtomic(link, 'token', { mode: 0o600 })

    expect((await lstat(link)).isSymbolicLink()).toBe(false)
    expect(await readFile(link, 'utf8')).toBe('token')
    expect(await readFile(target, 'utf8')).toBe('untouched')
  })

  test('writes an existing file in place where its directory takes no new files', async () => {
    const dir = await scratch()
    const path = join(dir, 'doc.fig')
    await writeFile(path, 'old')
    await chmod(dir, 0o500)
    try {
      await writeFileAtomic(path, 'new', { symlink: 'follow' })
    } finally {
      await chmod(dir, 0o700)
    }

    expect(await readFile(path, 'utf8')).toBe('new')
    expect(await readdir(dir)).toEqual(['doc.fig'])
  })
})
