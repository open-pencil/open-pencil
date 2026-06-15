import { describe, test, expect } from 'bun:test'
import { mkdir, realpath, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'

import { resolveSafePath } from '#mcp/tool/output'

const isUnix = process.platform !== 'win32'

describe('MCP path scoping', () => {
  const root = resolve(tmpdir(), 'mcp-test-root')

  test('allows path inside root', async () => {
    try {
      await mkdir(root, { recursive: true })
      const result = await resolveSafePath(`${root}/design.fig`, root)
      expect(result.resolved).toBe(resolve(`${root}/design.fig`))
      // realPath is the canonical form (realpath-resolved), which may differ
      // from resolve() on macOS where /var -> /private/var
      const canonicalRoot = await realpath(root)
      expect(result.realPath).toBe(`${canonicalRoot}/design.fig`)
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  test('resolves relative path inside root', async () => {
    const result = await resolveSafePath('design.fig', root)
    expect(result.resolved).toBe(resolve(`${root}/design.fig`))
  })

  test('resolves nested relative path inside root', async () => {
    const result = await resolveSafePath('sub/dir/file.fig', root)
    expect(result.resolved).toBe(resolve(`${root}/sub/dir/file.fig`))
  })

  test('allows nested path inside root', async () => {
    const result = await resolveSafePath(`${root}/sub/dir/file.fig`, root)
    expect(result.resolved).toBe(resolve(`${root}/sub/dir/file.fig`))
  })

  test('allows root itself', async () => {
    const result = await resolveSafePath(root, root)
    expect(result.resolved).toBe(root)
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

  test.skipIf(!isUnix)('allows dangling symlink pointing inside root', async () => {
    const testDir = resolve(tmpdir(), 'mcp-symlink-dangling-inside-test')
    const linkPath = `${testDir}/dangling.fig`
    const insideTarget = `${testDir}/nonexistent-target.fig`
    try {
      await mkdir(testDir, { recursive: true })
      // Dangling symlink: target doesn't exist, but points inside root.
      // This is a legitimate use case — the target will be created by the
      // write operation. The target path is validated to be inside root.
      await symlink(insideTarget, linkPath)
      const result = await resolveSafePath(linkPath, testDir)
      expect(result.resolved).toBe(resolve(linkPath))
      // realPath should resolve to the target's canonical parent + filename
      const canonicalParent = await realpath(testDir)
      expect(result.realPath).toBe(`${canonicalParent}/nonexistent-target.fig`)
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
      // Returns both resolved (for display) and realPath (canonical, for writes).
      // The resolved path is the user-provided normalized path for usability.
      const result = await resolveSafePath(linkPath, testDir)
      expect(result.resolved).toBe(resolve(linkPath))
      // realPath must be the canonical target (not the symlink itself)
      const canonicalTarget = await realpath(targetFile)
      expect(result.realPath).toBe(canonicalTarget)
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
      const result = await resolveSafePath(filePath, testDir)
      expect(result.resolved).toBe(resolve(filePath))
      // realPath uses the canonical parent directory + filename
      const canonicalParent = await realpath(testDir)
      expect(result.realPath).toBe(`${canonicalParent}/new.fig`)
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
    const deepSegments = Array.from({ length: 70 }, () => 'sub').join('/')
    const deepRoot = resolve(tmpdir(), deepSegments)
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
      const deepFile = Array.from({ length: 70 }, () => 'sub').join('/') + '/file.fig'
      await expect(resolveSafePath(deepFile, testDir)).rejects.toThrow('depth limit exceeded')
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

  test.skipIf(!isUnix)('rejects circular symlinks', async () => {
    const testDir = resolve(tmpdir(), 'mcp-symlink-circular-test')
    const linkA = `${testDir}/a.fig`
    const linkB = `${testDir}/b.fig`
    try {
      await mkdir(testDir, { recursive: true })
      // Circular symlink chain: a -> b -> a
      await symlink(linkB, linkA)
      await symlink(linkA, linkB)
      await expect(resolveSafePath(linkA, testDir)).rejects.toThrow('depth limit exceeded')
    } finally {
      await rm(testDir, { recursive: true, force: true })
    }
  })

  test.skipIf(!isUnix)('allows absolute symlink target inside root', async () => {
    const testDir = resolve(tmpdir(), 'mcp-symlink-abs-inside-test')
    const targetDir = `${testDir}/targets`
    const targetFile = `${targetDir}/real.fig`
    const linkPath = `${testDir}/link.fig`
    try {
      await mkdir(targetDir, { recursive: true })
      await writeFile(targetFile, 'test')
      // Absolute symlink target pointing inside root
      await symlink(targetFile, linkPath)
      const result = await resolveSafePath(linkPath, testDir)
      expect(result.resolved).toBe(resolve(linkPath))
      const canonicalTarget = await realpath(targetFile)
      expect(result.realPath).toBe(canonicalTarget)
    } finally {
      await rm(testDir, { recursive: true, force: true })
    }
  })

  test.skipIf(!isUnix)('rejects absolute symlink target outside root', async () => {
    const testDir = resolve(tmpdir(), 'mcp-symlink-abs-outside-test')
    const outsideDir = resolve(tmpdir(), 'mcp-symlink-abs-outside-target')
    const outsideFile = `${outsideDir}/secret.fig`
    const linkPath = `${testDir}/link.fig`
    try {
      await mkdir(testDir, { recursive: true })
      await mkdir(outsideDir, { recursive: true })
      await writeFile(outsideFile, 'secret')
      // Absolute symlink target pointing outside root
      await symlink(outsideFile, linkPath)
      await expect(resolveSafePath(linkPath, testDir)).rejects.toThrow('outside the allowed root')
    } finally {
      await rm(testDir, { recursive: true, force: true })
      await rm(outsideDir, { recursive: true, force: true })
    }
  })

  test.skipIf(!isUnix)(
    'allows relative symlink with traversal that stays inside root',
    async () => {
      const testDir = resolve(tmpdir(), 'mcp-symlink-rel-traversal-test')
      const subDir = `${testDir}/sub`
      const targetFile = `${testDir}/target.fig`
      const linkPath = `${subDir}/link.fig`
      try {
        await mkdir(subDir, { recursive: true })
        await writeFile(targetFile, 'test')
        // Relative symlink: sub/link.fig -> ../target.fig (resolves inside root)
        await symlink('../target.fig', linkPath)
        const result = await resolveSafePath(linkPath, testDir)
        expect(result.resolved).toBe(resolve(linkPath))
        const canonicalTarget = await realpath(targetFile)
        expect(result.realPath).toBe(canonicalTarget)
      } finally {
        await rm(testDir, { recursive: true, force: true })
      }
    }
  )

  test.skipIf(!isUnix)('rejects self-referencing symlink', async () => {
    const testDir = resolve(tmpdir(), 'mcp-symlink-self-test')
    const linkPath = `${testDir}/self.fig`
    try {
      await mkdir(testDir, { recursive: true })
      // Self-referencing symlink: link.fig -> link.fig
      await symlink(linkPath, linkPath)
      await expect(resolveSafePath(linkPath, testDir)).rejects.toThrow('depth limit exceeded')
    } finally {
      await rm(testDir, { recursive: true, force: true })
    }
  })

  test.skipIf(!isUnix)('allows symlink chain inside root (non-dangling)', async () => {
    const testDir = resolve(tmpdir(), 'mcp-symlink-chain-test')
    const targetFile = `${testDir}/real.fig`
    const link1 = `${testDir}/link1.fig`
    const link2 = `${testDir}/link2.fig`
    try {
      await mkdir(testDir, { recursive: true })
      await writeFile(targetFile, 'test')
      // Chain: link2 -> link1 -> real.fig
      await symlink(targetFile, link1)
      await symlink(link1, link2)
      const result = await resolveSafePath(link2, testDir)
      expect(result.resolved).toBe(resolve(link2))
      const canonicalTarget = await realpath(targetFile)
      expect(result.realPath).toBe(canonicalTarget)
    } finally {
      await rm(testDir, { recursive: true, force: true })
    }
  })
})
