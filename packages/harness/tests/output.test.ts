import { describe, expect, test } from 'bun:test'
import { spawnSync } from 'node:child_process'
import { join } from 'node:path'

const output = join(import.meta.dir, '../src/output.ts')
// The companion runs under Node, whose console writes through process.stdout.
const nodeRunsTypeScript =
  spawnSync('node', ['-e', 'process.exit(process.features.typescript ? 0 : 1)']).status === 0

describe('reserveProtocolOutput', () => {
  test.skipIf(!nodeRunsTypeScript)(
    'keeps stdout for protocol messages and quiets npm runs its children start',
    () => {
      const script = `
      import { spawnSync } from 'node:child_process'
      const { reserveProtocolOutput } = await import(${JSON.stringify(output)})
      const writeProtocol = reserveProtocolOutput()
      console.log('library noise')
      process.stdout.write('more noise\\n')
      writeProtocol('{"type":"response"}\\n')
      const child = spawnSync(process.execPath, ['-p', 'process.env.npm_config_loglevel + " " + process.env.npm_config_audit'], { encoding: 'utf8' })
      writeProtocol(JSON.stringify({ npm: child.stdout.trim() }) + '\\n')
    `
      const result = spawnSync('node', ['--input-type=module', '-e', script], { encoding: 'utf8' })
      const lines = result.stdout.trim().split('\n')
      expect(lines.map((line) => JSON.parse(line))).toEqual([
        { type: 'response' },
        { npm: 'silent false' }
      ])
      expect(result.stderr).toContain('library noise')
      expect(result.stderr).toContain('more noise')
    }
  )
})
