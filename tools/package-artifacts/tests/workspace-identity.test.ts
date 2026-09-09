import { describe, expect, test } from 'bun:test'
import { mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { runCommand } from '../src/process'

describe('workspace module identity', () => {
  test('Bun source exports unify imports across different tsconfig scopes', async () => {
    const root = await mkdtemp(join(tmpdir(), 'workspace-identity-'))
    try {
      await mkdir(join(root, 'packages/graph/src'), { recursive: true })
      await mkdir(join(root, 'packages/graph/dist'), { recursive: true })
      await mkdir(join(root, 'packages/consumer'), { recursive: true })
      await mkdir(join(root, 'node_modules/@fixture'), { recursive: true })
      await symlink('../../packages/graph', join(root, 'node_modules/@fixture/graph'))
      await writeFile(
        join(root, 'tsconfig.json'),
        JSON.stringify({
          compilerOptions: { paths: { '@fixture/graph': ['./packages/graph/src/index.ts'] } }
        })
      )
      await writeFile(
        join(root, 'packages/consumer/tsconfig.json'),
        JSON.stringify({
          compilerOptions: { paths: { '#consumer/*': ['./src/*'] } }
        })
      )
      const implementation = 'let next = 0; export class Graph { id = ++next }'
      await writeFile(join(root, 'packages/graph/src/index.ts'), implementation)
      await writeFile(join(root, 'packages/graph/dist/index.js'), implementation)
      await writeFile(
        join(root, 'packages/consumer/index.ts'),
        "export { Graph } from '@fixture/graph'"
      )
      await writeFile(
        join(root, 'check.ts'),
        `
import { Graph as Direct } from '@fixture/graph'
import { Graph as Indirect } from './packages/consumer/index.ts'
console.log(JSON.stringify({ same: Direct === Indirect, ids: [new Direct().id, new Indirect().id] }))
`
      )
      for (const sourceFirst of [false, true]) {
        const conditions: Record<string, string> = {}
        if (sourceFirst) conditions.bun = './src/index.ts'
        conditions.import = './dist/index.js'
        conditions.default = './dist/index.js'
        await writeFile(
          join(root, 'packages/graph/package.json'),
          JSON.stringify({
            name: '@fixture/graph',
            type: 'module',
            exports: { '.': conditions }
          })
        )
        const result = await runCommand({
          command: process.execPath,
          args: ['check.ts'],
          cwd: root,
          timeoutMs: 10_000
        })
        expect(JSON.parse(result.stdout)).toEqual(
          sourceFirst ? { same: true, ids: [1, 2] } : { same: false, ids: [1, 1] }
        )
      }
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })
})
