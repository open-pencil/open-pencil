import { expect, test } from 'bun:test'

import {
  publishReleasePackages,
  type PublicationOperations,
  type PublicationPlanEntry
} from '../src/workflow'

function fixture() {
  const plan: PublicationPlanEntry[] = ['one', 'two'].map((name) => ({
    package: { directory: name, manifest: { name, version: '1.0.0' } },
    status: 'unpublished'
  }))
  const published: string[][] = []
  const artifacts = new Map([
    ['one@1.0.0', '/one.tgz'],
    ['two@1.0.0', '/two.tgz']
  ])
  const operations: PublicationOperations = {
    plan: async () => plan,
    artifacts: async () => artifacts,
    verify: async (_root, paths) => {
      expect(paths).toHaveLength(2)
    },
    execute: async ({ args }) => {
      published.push(args ?? [])
      return { stdout: '', stderr: '' }
    }
  }
  return { plan, published, artifacts, operations }
}

test('verification failure prevents every registry write', async () => {
  const state = fixture()
  state.operations.verify = async () => {
    throw new Error('broken consumer')
  }
  await expect(publishReleasePackages('/repo', state.operations)).rejects.toThrow('broken consumer')
  expect(state.published).toEqual([])
})

test('a partial retry verifies retained artifacts and publishes only pending versions', async () => {
  const state = fixture()
  const first = state.plan[0]
  if (!first) throw new Error('Missing fixture entry')
  first.status = 'published'
  let verified = false
  state.operations.verify = async (_root, artifacts) => {
    expect(artifacts).toEqual(['/one.tgz', '/two.tgz'])
    verified = true
  }
  state.operations.execute = async ({ args }) => {
    expect(verified).toBe(true)
    state.published.push(args ?? [])
    return { stdout: '', stderr: '' }
  }
  await publishReleasePackages('/repo', state.operations)
  expect(state.published).toHaveLength(1)
  expect(state.published[0]).toContain('/two.tgz')
})

test('mismatched artifacts prevent verification and publication', async () => {
  const state = fixture()
  state.artifacts.delete('two@1.0.0')
  state.artifacts.set('two@2.0.0', '/wrong.tgz')
  let verified = false
  state.operations.verify = async () => {
    verified = true
  }
  await expect(publishReleasePackages('/repo', state.operations)).rejects.toThrow(
    'Missing verified package artifact'
  )
  expect(verified).toBe(false)
  expect(state.published).toEqual([])
})
