import { describe, expect, test } from 'bun:test'
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { discoverTypeShapeFiles, isTypeShapeSourcePath } from '../src/files'

describe('type shape source discovery', () => {
  test('accepts canonical TypeScript source paths', () => {
    expect(isTypeShapeSourcePath('src/app/types.ts')).toBe(true)
    expect(isTypeShapeSourcePath('packages/core/src/tool.tsx')).toBe(true)
  })

  test('excludes declarations, dependencies, and generated output on every platform', () => {
    expect(isTypeShapeSourcePath('src/global.d.ts')).toBe(false)
    expect(isTypeShapeSourcePath('tools/docs/node_modules/zod/src/types.ts')).toBe(false)
    expect(isTypeShapeSourcePath('tools\\docs\\node_modules\\zod\\src\\types.ts')).toBe(false)
    expect(isTypeShapeSourcePath('packages/mcp/dist/generated.ts')).toBe(false)
    expect(isTypeShapeSourcePath('coverage/report.ts')).toBe(false)
    expect(isTypeShapeSourcePath('.worktrees/review/src/types.ts')).toBe(false)
  })

  test('does not discover installed or generated TypeScript sources', async () => {
    const root = await mkdtemp(join(tmpdir(), 'open-pencil-type-shapes-'))
    try {
      await Promise.all([
        mkdir(join(root, 'src'), { recursive: true }),
        mkdir(join(root, 'node_modules', 'dependency'), { recursive: true }),
        mkdir(join(root, 'dist'), { recursive: true })
      ])
      await Promise.all([
        writeFile(join(root, 'src', 'local.ts'), 'export interface Local { a: string; b: string }'),
        writeFile(
          join(root, 'node_modules', 'dependency', 'source.ts'),
          'export interface Dependency { a: string; b: string }'
        ),
        writeFile(join(root, 'dist', 'generated.ts'), 'export interface Generated { a: 1; b: 2 }'),
        writeFile(join(root, 'src', 'ambient.d.ts'), 'interface Ambient { a: string; b: string }')
      ])

      expect(await discoverTypeShapeFiles([root])).toEqual([`${root}/src/local.ts`])
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })
})
