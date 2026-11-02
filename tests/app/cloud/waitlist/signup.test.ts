import { describe, expect, test } from 'bun:test'

import { createFeedbackClient } from '@lawha/feedback/client'

import { joinWaitlist } from '@/app/cloud/waitlist/signup'

const SIGNUP = { email: 'ada@example.com', turnstileToken: 'token' }

/** A feedback client whose service answers every request with `status`, recording what it got. */
function service(status: number) {
  const requests: { url: string; body: string }[] = []
  const client = createFeedbackClient({
    origin: 'https://feedback.test',
    fetch: (input: RequestInfo | URL, init?: RequestInit) => {
      requests.push({ url: String(input), body: String(init?.body) })
      return Promise.resolve(new Response(null, { status }))
    }
  })
  return { client, requests }
}

describe('joining the Cloud waitlist', () => {
  test('posts the sign-up to the waitlist route', async () => {
    const { client, requests } = service(202)

    expect(await joinWaitlist(SIGNUP, client)).toBe('joined')
    expect(requests).toEqual([
      { url: 'https://feedback.test/waitlist', body: JSON.stringify(SIGNUP) }
    ])
  })

  test.each([
    [400, 'invalid'],
    [403, 'refused'],
    [429, 'limited'],
    [500, 'failed']
  ] as const)('reports a %i answer as %s', async (status, outcome) => {
    expect(await joinWaitlist(SIGNUP, service(status).client)).toBe(outcome)
  })

  test('reports a service it cannot reach as failed', async () => {
    const client = createFeedbackClient({
      origin: 'https://feedback.test',
      fetch: () => Promise.reject(new TypeError('Network connection lost'))
    })

    expect(await joinWaitlist(SIGNUP, client)).toBe('failed')
  })
})
