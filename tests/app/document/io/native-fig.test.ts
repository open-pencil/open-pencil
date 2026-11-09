import { describe, expect, test } from 'bun:test'

import { testPath } from '#tests/helpers/paths'

describe('Tauri fig export', () => {
  test('compresses only the document data through the Tauri Rust command', async () => {
    const proc = Bun.spawn([process.execPath, testPath('helpers/tauri/fig-export-fixture.ts')], {
      stdout: 'pipe',
      stderr: 'pipe'
    })
    const [stdout, stderr, exitCode] = await Promise.all([
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
      proc.exited
    ])

    expect({ exitCode, stdout, stderr }).toEqual({ exitCode: 0, stdout: '', stderr: '' })
  })
})
