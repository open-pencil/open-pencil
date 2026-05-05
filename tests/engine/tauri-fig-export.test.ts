import { describe, expect, test } from 'bun:test'

describe('Tauri fig export', () => {
  test('delegates fig archive construction to the Tauri Rust command', async () => {
    const proc = Bun.spawn(['bun', 'tests/helpers/tauri-fig-export-fixture.ts'], {
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
