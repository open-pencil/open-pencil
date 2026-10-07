import { expect, test } from 'bun:test'

import {
  isVerifiedTree,
  queuedPullRequest,
  recordVerifiedTree,
  VERIFIED_TREE_CONTEXT
} from '#ci/verified-tree'

const HEAD = 'a'.repeat(40)
const TREE = 'b'.repeat(40)
const OTHER_TREE = 'c'.repeat(40)
const QUEUE_REF = `refs/heads/gh-readonly-queue/master/pr-923-${'d'.repeat(40)}`

/** A GitHub API stand-in: the PR's head and the statuses recorded on it, newest first. */
function github(statuses: unknown[], requests: Request[] = []): typeof fetch {
  const respond = async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = new Request(input, init)
    requests.push(request)
    const path = new URL(request.url).pathname
    if (path.endsWith('/pulls/923')) return Response.json({ head: { sha: HEAD } })
    if (path.endsWith(`/commits/${HEAD}/statuses`)) return Response.json(statuses)
    if (path.endsWith(`/statuses/${HEAD}`)) return Response.json({}, { status: 201 })
    return new Response('not found', { status: 404 })
  }
  return Object.assign(respond, { preconnect: fetch.preconnect })
}

const access = (fetcher: typeof fetch) => ({ repository: 'o/r', token: 't', fetch: fetcher })
const status = (description: string, state = 'success') => ({
  context: VERIFIED_TREE_CONTEXT,
  state,
  description
})

test('reads the pull request from a merge queue branch', () => {
  expect(queuedPullRequest(QUEUE_REF)).toBe(923)
  expect(queuedPullRequest('refs/heads/master')).toBeUndefined()
  expect(queuedPullRequest('gh-readonly-queue/master/pr-x-123')).toBeUndefined()
})

test('a queued tree is verified only by the latest record of exactly that tree', async () => {
  const verified = (statuses: unknown[], ref = QUEUE_REF) =>
    isVerifiedTree(access(github(statuses)), ref, TREE)

  expect(await verified([status(TREE)])).toBe(true)
  // Master moved since the PR's CI, so the queue tests a different tree.
  expect(await verified([status(OTHER_TREE)])).toBe(false)
  // A newer record for another tree supersedes an older match.
  expect(await verified([status(OTHER_TREE), status(TREE)])).toBe(false)
  expect(await verified([status(TREE, 'failure')])).toBe(false)
  expect(await verified([])).toBe(false)
  expect(await verified([status(TREE)], 'refs/heads/feature')).toBe(false)
})

test('records the tested tree on the pull request head', async () => {
  const requests: Request[] = []
  await recordVerifiedTree(access(github([], requests)), HEAD, TREE)
  const [request] = requests
  expect(request?.method).toBe('POST')
  expect(new URL(request?.url ?? 'https://invalid').pathname).toBe(`/repos/o/r/statuses/${HEAD}`)
  expect(await request?.json()).toEqual(status(TREE))
  await expect(recordVerifiedTree(access(github([])), 'not-a-sha', TREE)).rejects.toThrow()
})
