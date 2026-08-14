import { afterEach, describe, expect, test } from 'bun:test'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

const temporaryDirectories: string[] = []
const repositoryRoot = resolve(import.meta.dir, '../../..')
const oxlint = join(repositoryRoot, 'node_modules/.bin/oxlint')
const plugin = join(repositoryRoot, 'lint/plugin.js')

function lint(source: string): ReturnType<typeof Bun.spawnSync> {
  const directory = mkdtempSync(join(tmpdir(), 'open-pencil-acronym-lint-'))
  temporaryDirectories.push(directory)
  const config = join(directory, 'oxlint.json')
  const file = join(directory, 'fixture.ts')
  writeFileSync(
    config,
    JSON.stringify({
      jsPlugins: [plugin],
      rules: { 'open-pencil/no-mixed-case-acronym-identifiers': 'error' }
    })
  )
  writeFileSync(file, source)
  return Bun.spawnSync([oxlint, '--config', config, file], {
    stdout: 'pipe',
    stderr: 'pipe'
  })
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true })
  }
})

describe('acronym identifier casing', () => {
  test('rejects mixed-case first-party acronym identifiers', () => {
    const result = lint(
      'export class CloudCorsError {}\nexport function sendRpc() {}\nexport type FontPickerUi = {}'
    )
    expect(result.exitCode).toBe(1)
    expect(result.stdout.toString()).toContain('CloudCorsError')
    expect(result.stdout.toString()).toContain('sendRpc')
    expect(result.stdout.toString()).toContain('FontPickerUi')
  })

  test('accepts canonical first-party acronym identifiers', () => {
    const result = lint('export class CloudCORSError {}\nexport function sendRPC() {}')
    expect(result.exitCode).toBe(0)
  })

  test('allows immutable upstream imports and serialized property keys', () => {
    const result = lint(`
import { formatRgb } from 'culori'
const payload = { thumbnailPng: formatRgb({ mode: 'rgb', r: 0, g: 0, b: 0 }) }
export const thumbnailPNG = payload.thumbnailPng
`)
    expect(result.exitCode).toBe(0)
  })
})
