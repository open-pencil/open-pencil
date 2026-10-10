import { afterEach, describe, expect, test } from 'bun:test'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { landingPosterFingerprint } from '#landing-posters/fingerprint'

const INPUTS = { directories: ['theme', 'src'], files: ['package.json'] }
let root = ''

async function fixture(): Promise<string> {
  root = await mkdtemp(join(tmpdir(), 'landing-posters-'))
  await mkdir(join(root, 'theme/landing'), { recursive: true })
  await mkdir(join(root, 'src'), { recursive: true })
  await writeFile(join(root, 'theme/landing/page.vue'), '<template />')
  await writeFile(join(root, 'src/app.ts'), 'export {}')
  await writeFile(join(root, 'package.json'), '{}')
  return root
}

afterEach(async () => {
  if (root) await rm(root, { recursive: true, force: true })
})

describe('landing poster fingerprint', () => {
  test('is stable for unchanged sources', async () => {
    const dir = await fixture()
    const first = await landingPosterFingerprint(dir, INPUTS)
    expect(first).toMatch(/^[0-9a-f]{16}$/)
    expect(await landingPosterFingerprint(dir, INPUTS)).toBe(first)
  })

  test('changes when a nested source, a new file, or a listed file changes', async () => {
    const dir = await fixture()
    const seen = new Set([await landingPosterFingerprint(dir, INPUTS)])

    await writeFile(join(dir, 'theme/landing/page.vue'), '<template><p /></template>')
    seen.add(await landingPosterFingerprint(dir, INPUTS))
    await writeFile(join(dir, 'src/new.ts'), 'export {}')
    seen.add(await landingPosterFingerprint(dir, INPUTS))
    await writeFile(join(dir, 'package.json'), '{"version":"1"}')
    seen.add(await landingPosterFingerprint(dir, INPUTS))

    expect(seen.size).toBe(4)
  })
})
