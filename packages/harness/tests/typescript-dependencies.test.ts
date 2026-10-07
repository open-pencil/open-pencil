import { describe, expect, test } from 'bun:test'
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const hook = join(import.meta.dir, '../src/typescript-dependencies.ts')
// The hook needs Node's module hooks and type stripping, which older Node versions lack.
const nodeSupportsHook =
  spawnSync('node', [
    '-e',
    "const m = require('node:module'); process.exit(typeof m.registerHooks === 'function' && typeof m.stripTypeScriptTypes === 'function' && process.features.typescript ? 0 : 1)"
  ]).status === 0

function importUnderNode(register: boolean) {
  const root = mkdtempSync(join(tmpdir(), 'openpencil-harness-ts-'))
  try {
    const dependency = join(root, 'node_modules', 'typed-dependency')
    mkdirSync(dependency, { recursive: true })
    writeFileSync(join(dependency, 'package.json'), '{"type":"module","exports":"./index.ts"}')
    writeFileSync(join(dependency, 'index.ts'), 'export const value: number = 42\n')
    const script = [
      register
        ? `const { loadTypeScriptDependencies } = await import(${JSON.stringify(hook)})`
        : '',
      register ? 'loadTypeScriptDependencies()' : '',
      "const { value } = await import('typed-dependency')",
      'console.log(value)'
    ].join('\n')
    return spawnSync('node', ['--no-warnings', '--input-type=module', '-e', script], {
      cwd: root,
      encoding: 'utf8'
    })
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
}

describe('loadTypeScriptDependencies', () => {
  test.skipIf(!nodeSupportsHook)(
    'lets Node import a dependency that publishes TypeScript sources',
    () => {
      expect(importUnderNode(false).status).not.toBe(0)
      const result = importUnderNode(true)
      expect(result.stderr).toBe('')
      expect(result.stdout.trim()).toBe('42')
    }
  )
})
