import { describe, expect, test } from 'bun:test'

import {
  HEARTBEAT_URL,
  messageFor,
  monitorProblem,
  previousConclusion
} from '#cloud-deploy/watchdog'

const NOW = new Date('2026-11-19T10:00:00.000Z')

const answering =
  (response: () => Response) =>
  async (url: string): Promise<Response> => {
    expect(url).toBe(HEARTBEAT_URL)
    return response()
  }

const heartbeat = (lastRun: string | null) => () => new Response(JSON.stringify({ lastRun }))

describe('monitorProblem', () => {
  test('passes a monitor that ran within ten minutes', async () => {
    expect(await monitorProblem(answering(heartbeat('2026-11-19T09:51:00.000Z')), NOW)).toBe(
      undefined
    )
  })

  test('names a stale, missing, or unreachable monitor', async () => {
    expect(await monitorProblem(answering(heartbeat('2026-11-19T09:40:00.000Z')), NOW)).toBe(
      'The monitor last ran 20 minutes ago'
    )
    expect(await monitorProblem(answering(heartbeat(null)), NOW)).toBe('The monitor has never run')
    expect(
      await monitorProblem(
        answering(() => new Response(null, { status: 522 })),
        NOW
      )
    ).toBe('The feedback Worker answered HTTP 522')
    expect(
      await monitorProblem(async () => {
        throw new Error('connect ECONNREFUSED')
      }, NOW)
    ).toBe('The feedback Worker did not answer: connect ECONNREFUSED')
  })
})

describe('previousConclusion', () => {
  test('skips this run and reads the one before it', async () => {
    const conclusion = await previousConclusion(
      async (url) => {
        expect(url).toContain(
          '/repos/open-pencil/open-pencil/actions/workflows/monitor-watchdog.yml/runs'
        )
        return new Response(
          JSON.stringify({
            workflow_runs: [
              { id: 7, conclusion: 'success' },
              { id: 6, conclusion: 'failure' }
            ]
          })
        )
      },
      { repository: 'open-pencil/open-pencil', token: 'token', runId: '7' }
    )
    expect(conclusion).toBe('failure')
  })
})

describe('messageFor', () => {
  test('posts only when the outcome changes', () => {
    expect(messageFor('The monitor has never run', 'success')).toStartWith(
      '🔴 The monitor has stopped'
    )
    expect(messageFor('The monitor has never run', undefined)).toStartWith('🔴')
    expect(messageFor('The monitor has never run', 'failure')).toBeUndefined()
    expect(messageFor(undefined, 'failure')).toBe('🟢 The monitor is running again · watchdog')
    expect(messageFor(undefined, 'success')).toBeUndefined()
  })
})
