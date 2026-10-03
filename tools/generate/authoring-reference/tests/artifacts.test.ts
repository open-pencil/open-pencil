import { afterEach, expect, test } from 'bun:test'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import {
  AUTHORING_REFERENCE_ARTIFACTS,
  staleReferences,
  writeReferences
} from '#authoring-reference/artifacts'

const roots: string[] = []
afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })))
})

test('detects missing and edited references without rewriting during checks', async () => {
  const root = await mkdtemp(join(tmpdir(), 'open-pencil-authoring-'))
  roots.push(root)
  const paths = Object.keys(AUTHORING_REFERENCE_ARTIFACTS)
  expect(await staleReferences(root)).toEqual(paths)
  await writeReferences(root)
  expect(await staleReferences(root)).toEqual([])
  const path = paths[0]
  expect(path).toBeDefined()
  await writeFile(join(root, path), 'outdated')
  expect(await staleReferences(root)).toEqual([path])
  expect(await staleReferences(root)).toEqual([path])
})
