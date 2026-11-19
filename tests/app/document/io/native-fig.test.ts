import { describe, expect, test } from 'bun:test'

import { testPath } from '#tests/helpers/paths'

describe('Tauri fig export', () => {
  test('compresses the document data in Rust and writes the archive around it', async () => {
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
