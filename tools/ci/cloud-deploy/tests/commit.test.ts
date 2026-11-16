import { describe, expect, test } from 'bun:test'

import { deployCommit, type GitHubGet } from '#cloud-deploy/commit'

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

describe('deployCommit', () => {
  test('deploys the dispatched commit to staging without asking GitHub', async () => {
    const { get, paths } = gitHub([])
    expect(await deployCommit('staging', DISPATCHED, get)).toBe(DISPATCHED)
    expect(paths).toEqual([])
  })

  test('promotes the commit staging runs to production', async () => {
    const { get, paths } = gitHub([{ sha: STAGED, states: ['success', 'in_progress', 'queued'] }])
    expect(await deployCommit('production', DISPATCHED, get)).toBe(STAGED)
    expect(paths[0]).toBe('deployments?environment=cloud-staging&per_page=1')
  })

  test.each(['waiting', 'in_progress', 'failure', 'error'])(
    'refuses while staging’s newest deployment is %s',
    async (state) => {
      const { get } = gitHub([{ sha: STAGED, states: [state, 'success'] }])
      await expect(deployCommit('production', DISPATCHED, get)).rejects.toThrow(`is ${state}`)
    }
  )

  test('refuses before staging has ever been deployed', async () => {
    await expect(deployCommit('production', DISPATCHED, gitHub([]).get)).rejects.toThrow(
      'never been deployed'
    )
  })
})
