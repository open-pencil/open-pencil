import { describe, test, expect } from 'bun:test'
import { mkdir, rm, symlink, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

import { resolveSafePath } from '#mcp/tool/output'

describe('MCP path scoping', () => {
  const root = resolve('/tmp/mcp-test-root')

  test('allows path inside root', async () => {
    expect(await resolveSafePath(`${root}/design.fig`, root)).toBe(`${root}/design.fig`)
  })

  test('allows nested path inside root', async () => {
    expect(await resolveSafePath(`${root}/sub/dir/file.fig`, root)).toBe(`${root}/sub/dir/file.fig`)
  })

  test('allows root itself', async () => {
    expect(await resolveSafePath(root, root)).toBe(root)
  })

  test('rejects path outside root', async () => {
    await expect(resolveSafePath('/etc/passwd', root)).rejects.toThrow('outside the allowed root')
  })

  test('rejects path traversal', async () => {
    await expect(resolveSafePath(`${root}/../../../etc/passwd`, root)).rejects.toThrow(
      'outside the allowed root'
    )
  })

  test('rejects sibling directory', async () => {
    await expect(resolveSafePath(`${root}/../other-root/file.fig`, root)).rejects.toThrow(
      'outside the allowed root'
    )
  })

  test('rejects root prefix trick (root-evil)', async () => {
    await expect(resolveSafePath(`${root}-evil/file.fig`, root)).rejects.toThrow(
      'outside the allowed root'
    )
  })

  test('rejects symlink pointing outside root', async () => {
    const testDir = resolve('/tmp/mcp-symlink-test')
    const linkPath = `${testDir}/escape.fig`
    try {
      await mkdir(testDir, { recursive: true })
      await symlink('/etc/passwd', linkPath)
      await expect(resolveSafePath(linkPath, testDir)).rejects.toThrow('outside the allowed root')
    } finally {
      await rm(testDir, { recursive: true, force: true })
    }
  })

  test('allows symlink pointing inside root', async () => {
    const testDir = resolve('/tmp/mcp-symlink-safe-test')
    const targetDir = `${testDir}/targets`
    const targetFile = `${targetDir}/real.fig`
    const linkPath = `${testDir}/link.fig`
    try {
      await mkdir(targetDir, { recursive: true })
      await writeFile(targetFile, 'test')
      await symlink(targetFile, linkPath)
      // Returns the resolved (not realpath) path — symlink target is
      // checked via realpath for security, but the returned path is
      // the user-provided normalized path for usability.
      await expect(resolveSafePath(linkPath, testDir)).resolves.toBe(resolve(linkPath))
    } finally {
      await rm(testDir, { recursive: true, force: true })
    }
  })

  test('rejects dangling symlink pointing outside root', async () => {
    const testDir = resolve('/tmp/mcp-symlink-dangling-test')
    const linkPath = `${testDir}/dangling.fig`
    try {
      await mkdir(testDir, { recursive: true })
      // Dangling symlink: target doesn't exist, points outside root
      await symlink('/etc/nonexistent-secret', linkPath)
      await expect(resolveSafePath(linkPath, testDir)).rejects.toThrow('outside the allowed root')
    } finally {
      await rm(testDir, { recursive: true, force: true })
    }
  })

  test('allows nonexistent file inside root', async () => {
    const testDir = resolve('/tmp/mcp-nonexistent-test')
    const filePath = `${testDir}/new.fig`
    try {
      await mkdir(testDir, { recursive: true })
      // File doesn't exist yet (common for save_file / export operations)
      await expect(resolveSafePath(filePath, testDir)).resolves.toBe(resolve(filePath))
    } finally {
      await rm(testDir, { recursive: true, force: true })
    }
  })
})
