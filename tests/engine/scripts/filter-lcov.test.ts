import { describe, expect, test } from 'bun:test'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'

const SCRIPT = 'scripts/coverage/filter-lcov.ts'

function runFilter(input: string, output: string) {
  const result = spawnSync('bun', [SCRIPT, input, output], { encoding: 'utf8' })
  return result
}

function buildRecord(path: string) {
  return [`SF:${path}`, 'DA:1,1', 'DA:2,0', 'LF:2', 'LH:1', 'end_of_record', ''].join('\n')
}

describe('filter-lcov', () => {
  test('drops packages/<pkg>/dist records and keeps src records', () => {
    const tmp = mkdtempSync(join(tmpdir(), 'filter-lcov-'))
    try {
      const input = join(tmp, 'lcov.info')
      const output = join(tmp, 'lcov.filtered.info')
      const content = [
        buildRecord('packages/core/dist/canvas/shapes.js'),
        buildRecord('packages/core/src/text/fonts.ts'),
        buildRecord('packages/vue/src/canvas/scene.ts')
      ].join('')
      writeFileSync(input, content)

      const result = runFilter(input, output)
      expect(result.status).toBe(0)

      const filtered = readFileSync(output, 'utf8')
      expect(filtered).not.toContain('packages/core/dist/canvas/shapes.js')
      expect(filtered).toContain('packages/core/src/text/fonts.ts')
      expect(filtered).toContain('packages/vue/src/canvas/scene.ts')
    } finally {
      rmSync(tmp, { recursive: true, force: true })
    }
  })

  test('drops node_modules and root-level dist records', () => {
    const tmp = mkdtempSync(join(tmpdir(), 'filter-lcov-'))
    try {
      const input = join(tmp, 'lcov.info')
      const output = join(tmp, 'lcov.filtered.info')
      const content = [
        buildRecord('node_modules/some-pkg/index.js'),
        buildRecord('dist/build/output.js'),
        buildRecord('src/views/AdminView.vue')
      ].join('')
      writeFileSync(input, content)

      const result = runFilter(input, output)
      expect(result.status).toBe(0)

      const filtered = readFileSync(output, 'utf8')
      expect(filtered).not.toContain('node_modules/some-pkg/index.js')
      expect(filtered).not.toContain('dist/build/output.js')
      expect(filtered).toContain('src/views/AdminView.vue')
    } finally {
      rmSync(tmp, { recursive: true, force: true })
    }
  })

  test('drops *.test.ts records (Bun emits coverage for test files too)', () => {
    const tmp = mkdtempSync(join(tmpdir(), 'filter-lcov-'))
    try {
      const input = join(tmp, 'lcov.info')
      const output = join(tmp, 'lcov.filtered.info')
      const content = [
        buildRecord('tests/engine/text/fonts/loading.test.ts'),
        buildRecord('src/views/DashboardView.vue')
      ].join('')
      writeFileSync(input, content)

      const result = runFilter(input, output)
      expect(result.status).toBe(0)

      const filtered = readFileSync(output, 'utf8')
      expect(filtered).not.toContain('loading.test.ts')
      expect(filtered).toContain('src/views/DashboardView.vue')
    } finally {
      rmSync(tmp, { recursive: true, force: true })
    }
  })
})
