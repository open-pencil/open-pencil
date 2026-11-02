import { expect, test } from 'bun:test'
import { mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import {
  adoptPublishedReleaseArtifacts,
  assertPublishedReleaseArtifacts,
  releaseSourceFromEnv,
  tarballIntegrity,
  type ResumeOperations
} from '#release/resume'
import type { PublicationPlanEntry } from '#release/workflow'

const source = {
  repository: 'lawha/lawha',
  tag: 'v1.0.0-beta.1',
  commit: 'a'.repeat(40)
}
const registryBytes = new TextEncoder().encode('registry tarball')

async function fixture() {
  const directory = await mkdtemp(join(tmpdir(), 'release-resume-'))
  const published = join(directory, 'one-1.0.0-beta.1.tgz')
  const pending = join(directory, 'two-1.0.0-beta.1.tgz')
  await writeFile(published, 'rebuilt tarball')
  await writeFile(pending, 'pending tarball')
  const plan: PublicationPlanEntry[] = [
    {
      package: { directory: 'one', manifest: { name: 'one', version: '1.0.0-beta.1' } },
      status: 'published'
    },
    {
      package: { directory: 'two', manifest: { name: 'two', version: '1.0.0-beta.1' } },
      status: 'unpublished'
    }
  ]
  const verified: string[] = []
  const operations: ResumeOperations = {
    plan: async () => plan,
    artifacts: async () =>
      new Map([
        ['one@1.0.0-beta.1', published],
        ['two@1.0.0-beta.1', pending]
      ]),
    verify: async (name, version, release) => {
      expect(release).toEqual(source)
      verified.push(`${name}@${version}`)
      return {
        run: 'https://github.com/aliaaldihnayn-lab/design/actions/runs/1/attempts/1',
        integrity: tarballIntegrity(registryBytes),
        tarball: 'https://registry.npmjs.org/one/-/one-1.0.0-beta.1.tgz'
      }
    },
    download: async () => registryBytes,
    write: writeFile
  }
  return { published, pending, verified, operations }
}

test("replaces a published version's rebuilt tarball with the registry's bytes", async () => {
  const state = await fixture()
  expect(await adoptPublishedReleaseArtifacts('/repo', source, state.operations)).toEqual([
    'one@1.0.0-beta.1'
  ])
  expect(state.verified).toEqual(['one@1.0.0-beta.1'])
  expect(new Uint8Array(await readFile(state.published))).toEqual(registryBytes)
  expect(await readFile(state.pending, 'utf8')).toBe('pending tarball')
  await assertPublishedReleaseArtifacts('/repo', source, state.operations)
})

test('the check refuses a published version whose local tarball is not the registry copy', async () => {
  const state = await fixture()
  await expect(assertPublishedReleaseArtifacts('/repo', source, state.operations)).rejects.toThrow(
    'already published with other bytes'
  )
})

test('refuses a download that does not match the registry integrity', async () => {
  const state = await fixture()
  state.operations.download = async () => new TextEncoder().encode('tampered')
  await expect(adoptPublishedReleaseArtifacts('/repo', source, state.operations)).rejects.toThrow(
    'does not match its integrity'
  )
  expect(await readFile(state.published, 'utf8')).toBe('rebuilt tarball')
})

test('stops when a published version was not published by this tag', async () => {
  const state = await fixture()
  state.operations.verify = async (name, version) => {
    throw new Error(`${name}@${version} was not published by ${source.tag}: built from commit b`)
  }
  await expect(adoptPublishedReleaseArtifacts('/repo', source, state.operations)).rejects.toThrow(
    'was not published by'
  )
  expect(await readFile(state.published, 'utf8')).toBe('rebuilt tarball')
})

test('matches npm integrity strings and reads the release from the workflow environment', () => {
  expect(tarballIntegrity(new TextEncoder().encode('abc'))).toBe(
    'sha512-3a81oZNherrMQXNJriBBMRLm+k6JqX6iCp7u5ktV05ohkpkqJ0/BqDa6PCOj/uu9RU1EI2Q86A4qmslPpUyknw=='
  )
  expect(
    releaseSourceFromEnv({
      RELEASE_TAG: source.tag,
      SOURCE_COMMIT: source.commit,
      GITHUB_REPOSITORY: source.repository
    })
  ).toEqual(source)
})
