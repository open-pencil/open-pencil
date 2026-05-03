import { describe, test, expect } from 'bun:test'
import { resolve, sep } from 'node:path'

// Test the resolveSafePath logic directly (extracted for testability)
function resolveSafePath(filePath: string, root: string): string {
  const resolved = resolve(filePath)
  const normalizedSep = root.endsWith('/') || root.endsWith('\\') ? '' : sep
  if (!resolved.startsWith(root + normalizedSep) && resolved !== root) {
    throw new Error(`Path is outside the allowed root: ${root}`)
  }
  return resolved
}

describe('MCP path scoping', () => {
  const root = resolve('/tmp/mcp-test-root')

  test('allows path inside root', () => {
    expect(resolveSafePath(`${root}/design.fig`, root)).toBe(`${root}/design.fig`)
  })

  test('allows nested path inside root', () => {
    expect(resolveSafePath(`${root}/sub/dir/file.fig`, root)).toBe(`${root}/sub/dir/file.fig`)
  })

  test('allows root itself', () => {
    expect(resolveSafePath(root, root)).toBe(root)
  })

  test('rejects path outside root', () => {
    expect(() => resolveSafePath('/etc/passwd', root)).toThrow('outside the allowed root')
  })

  test('rejects path traversal', () => {
    expect(() => resolveSafePath(`${root}/../../../etc/passwd`, root)).toThrow(
      'outside the allowed root'
    )
  })

  test('rejects sibling directory', () => {
    expect(() => resolveSafePath(`${root}/../other-root/file.fig`, root)).toThrow(
      'outside the allowed root'
    )
  })

  test('rejects root prefix trick (root-evil)', () => {
    expect(() => resolveSafePath(`${root}-evil/file.fig`, root)).toThrow('outside the allowed root')
  })
})
