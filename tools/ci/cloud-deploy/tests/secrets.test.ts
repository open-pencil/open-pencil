import { expect, test } from 'bun:test'
import { mkdtemp, readFile, rm, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { workerSecrets, writeWorkerSecrets } from '#cloud-deploy/secrets'

test('collects each named secret from the environment', () => {
  expect(workerSecrets(['A', 'B'], { A: 'one', B: 'two', C: 'other' })).toEqual({
    A: 'one',
    B: 'two'
  })
})

test('refuses missing or empty secrets instead of deploying them empty', () => {
  expect(() => workerSecrets(['A', 'B', 'C'], { A: 'one', B: '' })).toThrow('Missing secrets: B, C')
  expect(() => workerSecrets([], {})).toThrow()
})

test('passes an optional secret on only where the environment sets it', () => {
  expect(workerSecrets(['A', 'B?'], { A: 'one', B: 'two' })).toEqual({ A: 'one', B: 'two' })
  expect(workerSecrets(['A', 'B?'], { A: 'one', B: '' })).toEqual({ A: 'one' })
  expect(() => workerSecrets(['A', 'B?'], { B: 'two' })).toThrow('Missing secrets: A')
})

test('writes the file readable only by its owner', async () => {
  const root = await mkdtemp(join(tmpdir(), 'cloud-secrets-'))
  try {
    const path = join(root, 'secrets.json')
    await writeWorkerSecrets(path, ['A'], { A: 'one' })
    expect(JSON.parse(await readFile(path, 'utf8'))).toEqual({ A: 'one' })
    expect((await stat(path)).mode & 0o777).toBe(0o600)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})
