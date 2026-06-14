import { describe, test, expect } from 'bun:test'
import { mkdir, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'

import { resolveSafePath } from '#mcp/tool/output'

const isUnix = process.platform !== 'win32'

describe('MCP path scoping', () => {
  const root = resolve(tmpdir(), 'mcp-test-root')

  test('allows path inside root', async () => {
    expect(await resolveSafePath(`${root}/design.fig`, root)).toBe(resolve(`${root}/design.fig`))
  })

  test('resolves relative path inside root', async () => {
    expect(await resolveSafePath('design.fig', root)).toBe(resolve(`${root}/design.fig`))
  })

  test('resolves nested relative path inside root', async () => {
    expect(await resolveSafePath('sub/dir/file.fig', root)).toBe(
      resolve(`${root}/sub/dir/file.fig`)
    )
  })

  test('allows nested path inside root', async () => {
    expect(await resolveSafePath(`${root}/sub/dir/file.fig`, root)).toBe(
      resolve(`${root}/sub/dir/file.fig`)
    )
  })

  test('allows root itself', async () => {
    expect(await resolveSafePath(root, root)).toBe(root)
  })

  test('rejects path outside root', async () => {
    const outsideRoot = resolve(tmpdir(), 'mcp-outside-root')
    await expect(resolveSafePath(`${outsideRoot}/passwd`, root)).rejects.toThrow(
      'outside the allowed root'
    )
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

  test.skipIf(!isUnix)('rejects dangling symlink pointing outside root', async () => {
    const testDir = resolve(tmpdir(), 'mcp-symlink-test')
    const linkPath = `${testDir}/escape.fig`
    const outsideTarget = resolve(tmpdir(), 'mcp-symlink-outside-target')
    try {
      await mkdir(testDir, { recursive: true })
      // Create the target so the symlink is NOT dangling — this exercises
      // the realpath → outside-root branch rather than the dangling path.
      await mkdir(outsideTarget, { recursive: true })
      await symlink(outsideTarget, linkPath)
      await expect(resolveSafePath(linkPath, testDir)).rejects.toThrow('outside the allowed root')
    } finally {
      await rm(testDir, { recursive: true, force: true })
      await rm(outsideTarget, { recursive: true, force: true })
    }
  })

  test.skipIf(!isUnix)('rejects dangling symlink pointing inside root', async () => {
    const testDir = resolve(tmpdir(), 'mcp-symlink-dangling-inside-test')
    const linkPath = `${testDir}/dangling.fig`
    const insideTarget = `${testDir}/nonexistent-target.fig`
    try {
      await mkdir(testDir, { recursive: true })
      // Dangling symlink: target doesn't exist, but points inside root.
      // This should still be rejected because the target could be created
      // outside root by another process before the write happens.
      await symlink(insideTarget, linkPath)
      await expect(resolveSafePath(linkPath, testDir)).rejects.toThrow('outside the allowed root')
    } finally {
      await rm(testDir, { recursive: true, force: true })
    }
  })

  test.skipIf(!isUnix)('allows symlink pointing inside root', async () => {
    const testDir = resolve(tmpdir(), 'mcp-symlink-safe-test')
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

  test.skipIf(!isUnix)('rejects dangling symlink pointing outside root', async () => {
    const testDir = resolve(tmpdir(), 'mcp-symlink-dangling-test')
    const linkPath = `${testDir}/dangling.fig`
    const outsideTarget = resolve(tmpdir(), 'mcp-symlink-dangling-outside')
    try {
      await mkdir(testDir, { recursive: true })
      // Dangling symlink: target doesn't exist, points outside root
      await symlink(outsideTarget, linkPath)
      await expect(resolveSafePath(linkPath, testDir)).rejects.toThrow('outside the allowed root')
    } finally {
      await rm(testDir, { recursive: true, force: true })
    }
  })

  test('allows nonexistent file inside root', async () => {
    const testDir = resolve(tmpdir(), 'mcp-nonexistent-test')
    const filePath = `${testDir}/new.fig`
    try {
      await mkdir(testDir, { recursive: true })
      // File doesn't exist yet (common for save_file / export operations)
      await expect(resolveSafePath(filePath, testDir)).resolves.toBe(resolve(filePath))
    } finally {
      await rm(testDir, { recursive: true, force: true })
    }
  })

  test('rejects trivially broad root "/"', async () => {
    await expect(resolveSafePath('/some/path', '/')).rejects.toThrow('Root path is too broad')
  })

  test.skipIf(process.platform !== 'win32')(
    'rejects drive root as broad root on Windows',
    async () => {
      // On Windows, path.parse('C:\\').root === 'C:\\', which resolveSafePath
      // should reject. This test runs only on Windows where drive roots exist.
      const { parse, resolve: winResolve } = await import('node:path')
      const driveRoot = parse(winResolve('C:\\')).root
      await expect(resolveSafePath('C:\\some\\path', driveRoot)).rejects.toThrow(
        'Root path is too broad'
      )
    }
  )

  test('rejects path exceeding resolution depth limit', async () => {
    // resolveRealAncestor has a 64-iteration depth cap. When the entire
    // ancestor chain doesn't exist (e.g., a deep non-existent root path),
    // the function must fail closed rather than returning a partially-resolved
    // path that could bypass containment checks.
    const deepRoot = resolve(tmpdir(), Array(70).fill('sub').join('/'))
    await expect(resolveSafePath(`${deepRoot}/file.fig`, deepRoot)).rejects.toThrow(
      'depth limit exceeded'
    )
  })

  test('rejects deep file path exceeding resolution depth limit with existing root', async () => {
    // When the root exists but the file path has >64 non-existent ancestor
    // segments, resolveRealAncestor is called for the parent directory and
    // must fail closed. This exercises the second call site (line 142 in
    // output.ts: resolveRealAncestor(parentDir)).
    const testDir = resolve(tmpdir(), 'mcp-deep-path-test')
    try {
      await mkdir(testDir, { recursive: true })
      // 70 non-existent subdirectories under an existing root
      const deepFile = Array(70).fill('sub').join('/') + '/file.fig'
      await expect(resolveSafePath(deepFile, testDir)).rejects.toThrow(
        'depth limit exceeded'
      )
    } finally {
      await rm(testDir, { recursive: true, force: true })
    }
  })

  test.skipIf(!isUnix)('rejects symlinked root that resolves to /', async () => {
    const testDir = resolve(tmpdir(), 'mcp-symlink-root-test')
    const rootLink = `${testDir}/root-link`
    try {
      await mkdir(testDir, { recursive: true })
      await symlink('/', rootLink)
      await expect(resolveSafePath(`${rootLink}/file.fig`, rootLink)).rejects.toThrow(
        'Root path is too broad'
      )
    } finally {
      await rm(testDir, { recursive: true, force: true })
    }
  })
})
