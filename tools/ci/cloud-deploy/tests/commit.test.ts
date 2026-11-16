import { describe, expect, test } from 'bun:test'

import { deployCommit, servingCommit, type GitHubGet } from '#cloud-deploy/commit'
import type { CloudTarget } from '#cloud-deploy/ref'

import type { CommandRequest } from '@open-pencil/package-artifacts-tools'

const STAGED = 'e60fbae32e5f0e8ba6f7d59d9aeef14031249aa8'
const DISPATCHED = 'd89d88c3569f73af446af0076878df0bc002149a'

/** Staging's deployments as GitHub lists them, newest first, each with its statuses newest first. */
function gitHub(deployments: { sha: string; states: string[] }[]): {
  get: GitHubGet
  paths: string[]
} {
  const paths: string[] = []
  const get: GitHubGet = async (path) => {
    paths.push(path)
    if (path.startsWith('deployments?')) {
      return deployments.slice(0, 1).map(({ sha }, id) => ({ id, sha }))
    }
    const id = Number(/^deployments\/(\d+)\/statuses/.exec(path)?.[1])
    return (deployments[id]?.states ?? []).slice(0, 1).map((state) => ({ state }))
  }
  return { get, paths }
}

/** What each Worker serves: by default staging serves what its newest deployment names. */
function options(
  github: GitHubGet,
  serving: Partial<Record<CloudTarget, string>> = { staging: STAGED },
  keep = false
) {
  return {
    dispatched: DISPATCHED,
    keep,
    github,
    serving: async (target: CloudTarget) => serving[target]
  }
}

describe('deployCommit', () => {
  test('deploys the dispatched commit to staging without asking GitHub', async () => {
    const { get, paths } = gitHub([])
    expect(await deployCommit('staging', options(get))).toBe(DISPATCHED)
    expect(paths).toEqual([])
  })

  test('promotes the commit staging runs to production', async () => {
    const { get, paths } = gitHub([{ sha: STAGED, states: ['success', 'in_progress', 'queued'] }])
    expect(await deployCommit('production', options(get))).toBe(STAGED)
    expect(paths[0]).toBe('deployments?environment=cloud-staging&per_page=1')
  })

  test.each(['waiting', 'in_progress', 'failure', 'error'])(
    'refuses while staging’s newest deployment is %s',
    async (state) => {
      const { get } = gitHub([{ sha: STAGED, states: [state, 'success'] }])
      await expect(deployCommit('production', options(get))).rejects.toThrow(`is ${state}`)
    }
  )

  test('refuses before staging has ever been deployed', async () => {
    await expect(deployCommit('production', options(gitHub([]).get))).rejects.toThrow(
      'never been deployed'
    )
  })

  test.each([
    ['rolled back in Cloudflare', 'd'.repeat(40)],
    ['untagged', undefined]
  ])('refuses to promote while staging is %s', async (_, served) => {
    const { get } = gitHub([{ sha: STAGED, states: ['success'] }])
    await expect(deployCommit('production', options(get, { staging: served }))).rejects.toThrow(
      'deploy staging again'
    )
  })

  test('keeps the commit production serves for maintenance and its end, without asking staging', async () => {
    const { get, paths } = gitHub([{ sha: STAGED, states: ['failure'] }])
    const serving = 'c5d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9'
    expect(await deployCommit('production', options(get, { production: serving }, true))).toBe(
      serving
    )
    expect(await deployCommit('production', options(get, {}, true))).toBe(DISPATCHED)
    expect(paths).toEqual([])
  })
})

describe('servingCommit', () => {
  function wrangler(status: unknown, version: unknown) {
    const asked: string[][] = []
    const execute = async (request: CommandRequest) => {
      const args = request.args ?? []
      asked.push(args)
      return { stdout: JSON.stringify(args.includes('status') ? status : version), stderr: '' }
    }
    return { asked, execute }
  }

  test('reads the tag of the version that takes every request', async () => {
    const { asked, execute } = wrangler(
      { versions: [{ version_id: 'v1', percentage: 100 }] },
      { annotations: { 'workers/tag': STAGED, 'workers/triggered_by': 'upload' } }
    )
    expect(await servingCommit('wrangler.jsonc', '/repo', execute)).toBe(STAGED)
    expect(asked[1]).toEqual([
      'wrangler',
      'versions',
      'view',
      'v1',
      '--json',
      '-c',
      'wrangler.jsonc'
    ])
  })

  test('names no commit for a version deployed before tags', async () => {
    expect(
      await servingCommit(
        'wrangler.jsonc',
        '/repo',
        wrangler({ versions: [{ version_id: 'v1', percentage: 100 }] }, { annotations: {} }).execute
      )
    ).toBeUndefined()
  })

  test('refuses a rollout that splits traffic, rather than guessing a commit', async () => {
    const split = {
      versions: [
        { version_id: 'v1', percentage: 50 },
        { version_id: 'v2', percentage: 50 }
      ]
    }
    await expect(
      servingCommit('wrangler.jsonc', '/repo', wrangler(split, {}).execute)
    ).rejects.toThrow('splits traffic')
  })
})
