import { describe, expect, test } from 'bun:test'
import { mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import {
  eventContext,
  monitorPRReviewGuidance,
  reviewGuidanceCheckName,
  reviewGuidanceChecks
} from '../src/index'

function response(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    headers: { 'content-type': 'application/json' },
    ...init
  })
}

async function writeEvent(event: unknown) {
  const dir = await mkdtemp(join(tmpdir(), 'open-pencil-pr-guidance-'))
  const path = join(dir, 'event.json')
  await writeFile(path, JSON.stringify(event), 'utf8')
  return path
}

describe('reviewGuidanceCheckName', () => {
  test('accepts legacy PR Hygiene errors from CodeRabbit tables', () => {
    expect(reviewGuidanceCheckName('| PR Hygiene: Template | ❌ Error | Missing template |')).toBe(
      'PR Hygiene: Template'
    )
  })

  test('accepts softer PR Description check names', () => {
    expect(reviewGuidanceCheckName('| PR Description: Context | Error | Add validation |')).toBe(
      'PR Description: Context'
    )
  })

  test('ignores unrelated or passing checks', () => {
    expect(reviewGuidanceCheckName('| Security | ❌ Error | Something else |')).toBeNull()
    expect(reviewGuidanceCheckName('| PR Description: Context | ✅ Pass | Fine |')).toBeNull()
  })
})

describe('reviewGuidanceChecks', () => {
  test('extracts only relevant failed checks', () => {
    const checks = reviewGuidanceChecks(`
| Check name | Status | Explanation |
|---|---|---|
| PR Description: Template | ❌ Error | Missing template |
| Security | ❌ Error | Not relevant |
| PR Readability: English | Error | Needs English |
`)

    expect(checks).toEqual(['PR Description: Template', 'PR Readability: English'])
  })
})

describe('eventContext', () => {
  test('reads pull request review events', () => {
    expect(
      eventContext({
        pull_request: { number: 42 },
        review: { state: 'changes_requested', body: 'review body' }
      })
    ).toEqual({ issueNumber: 42, shouldInspect: true, text: 'changes_requested\nreview body' })
  })

  test('reads pull request issue comments', () => {
    expect(
      eventContext({
        issue: { number: 42, pull_request: {} },
        comment: { body: 'comment body' }
      })
    ).toEqual({ issueNumber: 42, shouldInspect: true, text: 'comment body' })
  })
})

describe('monitorPRReviewGuidance', () => {
  test('logs a maintainer note and only reads PR data', async () => {
    const eventPath = await writeEvent({
      sender: { login: 'coderabbitai[bot]' },
      issue: { number: 294, pull_request: {} },
      comment: {
        body: '| Check name | Status | Explanation |\n|---|---|---|\n| PR Description: Template | ❌ Error | Missing template |'
      }
    })
    const requests: string[] = []
    const messages: string[] = []

    await monitorPRReviewGuidance({
      env: {
        GITHUB_API_URL: 'https://example.test',
        GITHUB_EVENT_PATH: eventPath,
        GITHUB_REPOSITORY: 'open-pencil/open-pencil',
        GITHUB_REPOSITORY_OWNER: 'open-pencil',
        GITHUB_TOKEN: 'token'
      },
      fetchImpl: (async (input, init) => {
        requests.push(`${init?.method ?? 'GET'} ${String(input)}`)
        return response({
          author_association: 'CONTRIBUTOR',
          state: 'open',
          title: 'feat(dev-install): add script',
          user: { login: 'joeycumines' }
        })
      }) satisfies typeof fetch,
      log: (message) => messages.push(message)
    })

    expect(requests).toEqual(['GET https://example.test/repos/open-pencil/open-pencil/pulls/294'])
    expect(messages.join('\n')).toContain('No automatic label, comment, or close was applied')
  })

  test('ignores non-CodeRabbit comments', async () => {
    const eventPath = await writeEvent({
      sender: { login: 'contributor' },
      issue: { number: 294, pull_request: {} },
      comment: { body: '| PR Description: Template | ❌ Error | Missing template |' }
    })
    const requests: string[] = []
    const messages: string[] = []

    await monitorPRReviewGuidance({
      env: {
        GITHUB_API_URL: 'https://example.test',
        GITHUB_EVENT_PATH: eventPath,
        GITHUB_REPOSITORY: 'open-pencil/open-pencil',
        GITHUB_REPOSITORY_OWNER: 'open-pencil',
        GITHUB_TOKEN: 'token'
      },
      fetchImpl: (async (input, init) => {
        requests.push(`${init?.method ?? 'GET'} ${String(input)}`)
        return response({})
      }) satisfies typeof fetch,
      log: (message) => messages.push(message)
    })

    expect(requests).toEqual([])
    expect(messages).toEqual(['No action needed: event sender is contributor, not CodeRabbit.'])
  })
})
