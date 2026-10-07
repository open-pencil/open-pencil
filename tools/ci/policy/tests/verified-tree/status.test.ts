import { expect, test } from 'bun:test'

import {
  isVerifiedTree,
  queuedPullRequest,
  recordVerifiedTree,
  VERIFIED_TREE_CONTEXT
} from '#ci/verified-tree/status'

const HEAD = 'a'.repeat(40)
const OTHER_HEAD = 'e'.repeat(40)
const TREE = 'b'.repeat(40)
const OTHER_TREE = 'c'.repeat(40)
const QUEUE_REF = `refs/heads/gh-readonly-queue/master/pr-923-${'d'.repeat(40)}`
const RUN_URL = 'https://github.com/o/r/actions/runs/42'

interface Run {
  path: string
  event: string
  conclusion: string
  head_sha: string
}
const PASSING_RUN: Run = {
  path: '.github/workflows/ci.yml',
  event: 'pull_request',
  conclusion: 'success',
  head_sha: HEAD
}

/** A GitHub API stand-in: the PR's head, the statuses on it (newest first), and run 42. */
function github(statuses: unknown[], run: Run = PASSING_RUN, requests: Request[] = []) {
  const respond = async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = new Request(input, init)
    requests.push(request)
    const path = new URL(request.url).pathname
    if (path.endsWith('/pulls/923')) return Response.json({ head: { sha: HEAD } })
    if (path.endsWith(`/commits/${HEAD}/statuses`)) return Response.json(statuses)
    if (path.endsWith('/actions/runs/42')) return Response.json(run)
    if (path.endsWith(`/statuses/${HEAD}`)) return Response.json({}, { status: 201 })
    return new Response('not found', { status: 404 })
  }
  return Object.assign(respond, { preconnect: fetch.preconnect })
}

const access = (fetcher: typeof fetch) => ({ repository: 'o/r', token: 't', fetch: fetcher })
function status(description: string, overrides: Record<string, unknown> = {}) {
  return {
    context: VERIFIED_TREE_CONTEXT,
    state: 'success',
    description,
    target_url: RUN_URL,
    creator: { login: 'github-actions[bot]' },
    ...overrides
  }
}

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
  expect(await verified([status(TREE, { state: 'failure' })])).toBe(false)
  expect(await verified([])).toBe(false)
  expect(await verified([status(TREE)], 'refs/heads/feature')).toBe(false)
})

test('a record counts only from a passing CI run on the same pull request head', async () => {
  const verified = (record: unknown, run?: Run) =>
    isVerifiedTree(access(github([record], run)), QUEUE_REF, TREE)

  // Anyone with write access can post a status with their own token.
  expect(await verified(status(TREE, { creator: { login: 'someone' } }))).toBe(false)
  expect(await verified(status(TREE, { target_url: undefined }))).toBe(false)
  expect(
    await verified(status(TREE, { target_url: 'https://github.com/x/r/actions/runs/42' }))
  ).toBe(false)
  // Another pull request's CI wrote it, or the run did not pass, or it was another workflow.
  expect(await verified(status(TREE), { ...PASSING_RUN, head_sha: OTHER_HEAD })).toBe(false)
  expect(await verified(status(TREE), { ...PASSING_RUN, conclusion: 'failure' })).toBe(false)
  expect(await verified(status(TREE), { ...PASSING_RUN, event: 'push' })).toBe(false)
  expect(await verified(status(TREE), { ...PASSING_RUN, path: '.github/workflows/x.yml' })).toBe(
    false
  )
})

test('records the tested tree and its run on the pull request head', async () => {
  const requests: Request[] = []
  await recordVerifiedTree(access(github([], PASSING_RUN, requests)), HEAD, TREE, RUN_URL)
  const [request] = requests
  expect(request?.method).toBe('POST')
  expect(new URL(request?.url ?? 'https://invalid').pathname).toBe(`/repos/o/r/statuses/${HEAD}`)
  expect(await request?.json()).toEqual({
    state: 'success',
    context: VERIFIED_TREE_CONTEXT,
    description: TREE,
    target_url: RUN_URL
  })
  await expect(recordVerifiedTree(access(github([])), 'not-a-sha', TREE, RUN_URL)).rejects.toThrow()
  await expect(
    recordVerifiedTree(access(github([])), HEAD, TREE, 'https://example.com/run')
  ).rejects.toThrow()
})
