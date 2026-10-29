import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'bun:test'

import { createTestService, type TestService } from '#feedback-tests/harness'
import type { WaitlistSignup } from '#feedback/contract'
import { createFeedbackDatabase } from '#feedback/db'
import { runRetention } from '#feedback/retention'

let service: TestService

const SIGNUP: WaitlistSignup = {
  email: 'Ada@Example.com',
  note: 'Team libraries',
  turnstileToken: 'token'
}
const START = new Date('2026-10-12T09:00:00.000Z')

function turnstile(result: { success: boolean; hostname?: string; action?: string }) {
  service.respond('https://challenges.cloudflare.com/', () => Response.json(result))
}

function rows() {
  return createFeedbackDatabase(service.db)
    .selectFrom('waitlist')
    .select(['email', 'note', 'confirmedAt'])
    .orderBy('id')
    .execute()
}

function linkFrom(text: string | undefined, path: string): URL {
  const match = text?.match(new RegExp(`https?://\\S+${path}\\?token=[0-9a-f]+`))
  if (!match) throw new Error(`No ${path} link in the email`)
  return new URL(match[0])
}

function postForm(url: URL) {
  const token = url.searchParams.get('token') ?? ''
  return service.request(url.pathname, { method: 'POST', body: new URLSearchParams({ token }) })
}

beforeAll(async () => {
  service = await createTestService()
})

beforeEach(async () => {
  await createFeedbackDatabase(service.db).deleteFrom('waitlist').execute()
  service.sentEmails.length = 0
  service.setNow(START)
  turnstile({ success: true, hostname: 'openpencil.dev', action: 'waitlist' })
})

afterAll(async () => {
  await service.dispose()
})

describe('waitlist', () => {
  test('emails a confirmation link and joins the list once confirmed', async () => {
    expect((await service.client.waitlist.$post({ json: SIGNUP })).status).toBe(202)
    expect(await rows()).toEqual([
      { email: 'Ada@Example.com', note: 'Team libraries', confirmedAt: null }
    ])
    expect(service.sentEmails).toHaveLength(1)
    const [email] = service.sentEmails
    expect(email.to).toBe('Ada@Example.com')
    expect(email.from).toEqual({ name: 'OpenPencil', email: 'hello@openpencil.dev' })

    const confirm = linkFrom(email.text, '/waitlist/confirm')
    // Opening the link only asks; a mail scanner following it confirms nothing.
    const asked = await service.request(`${confirm.pathname}${confirm.search}`)
    expect(asked.status).toBe(200)
    expect(await asked.text()).toContain('<form method="post">')
    expect((await rows())[0]).toMatchObject({ confirmedAt: null })

    const confirmed = await postForm(confirm)
    expect(confirmed.status).toBe(200)
    expect((await rows())[0]).toMatchObject({ confirmedAt: START.toISOString() })
  })

  test('sends no second email for the same address moments later, in any case', async () => {
    await service.postJSON('/waitlist', SIGNUP)
    await service.postJSON('/waitlist', { ...SIGNUP, email: 'ada@example.com' })

    expect(service.sentEmails).toHaveLength(1)
    expect(await rows()).toHaveLength(1)
  })

  test('sends the same link again after a while, until the address is confirmed', async () => {
    await service.postJSON('/waitlist', SIGNUP)
    service.setNow(new Date(START.getTime() + 11 * 60 * 1000))
    await service.postJSON('/waitlist', SIGNUP)

    expect(service.sentEmails).toHaveLength(2)
    const [first, second] = service.sentEmails
    expect(linkFrom(second.text, '/waitlist/confirm').href).toBe(
      linkFrom(first.text, '/waitlist/confirm').href
    )

    await postForm(linkFrom(first.text, '/waitlist/confirm'))
    service.setNow(new Date(START.getTime() + 30 * 60 * 1000))
    expect((await service.postJSON('/waitlist', SIGNUP)).status).toBe(202)
    expect(service.sentEmails).toHaveLength(2)
  })

  test('refuses a sign-up Turnstile rejects', async () => {
    turnstile({ success: false })

    expect((await service.postJSON('/waitlist', SIGNUP)).status).toBe(403)
    expect(await rows()).toEqual([])
    expect(service.sentEmails).toEqual([])
  })

  test('refuses a Turnstile pass issued for another form', async () => {
    turnstile({ success: true, hostname: 'openpencil.dev', action: 'newsletter' })

    expect((await service.postJSON('/waitlist', SIGNUP)).status).toBe(403)
  })

  test('refuses a sign-up when Turnstile cannot be reached', async () => {
    service.respond('https://challenges.cloudflare.com/', () => {
      throw new TypeError('Network connection lost')
    })

    expect((await service.postJSON('/waitlist', SIGNUP)).status).toBe(403)
    expect(await rows()).toEqual([])
  })

  test('accepts a Turnstile pass issued on the web app', async () => {
    turnstile({ success: true, hostname: 'app.openpencil.dev', action: 'waitlist' })

    expect((await service.postJSON('/waitlist', SIGNUP)).status).toBe(202)
  })

  test('refuses a Turnstile pass issued for another site', async () => {
    turnstile({ success: true, hostname: 'example.com', action: 'waitlist' })

    expect((await service.postJSON('/waitlist', SIGNUP)).status).toBe(403)
  })

  test('refuses an invalid address', async () => {
    expect((await service.postJSON('/waitlist', { ...SIGNUP, email: 'ada' })).status).toBe(400)
  })

  test('removes the address from the link in the email', async () => {
    await service.postJSON('/waitlist', SIGNUP)
    const leave = linkFrom(service.sentEmails[0].text, '/waitlist/leave')

    expect((await postForm(leave)).status).toBe(200)
    expect(await rows()).toEqual([])
  })

  test('shows an expired link for an unknown token', async () => {
    const response = await postForm(
      new URL(`https://feedback.openpencil.dev/waitlist/confirm?token=${'0'.repeat(64)}`)
    )

    expect(response.status).toBe(404)
  })

  test('keeps an unconfirmed sign-up for seven days', async () => {
    await service.postJSON('/waitlist', SIGNUP)
    await service.postJSON('/waitlist', { ...SIGNUP, email: 'grace@example.com' })
    await postForm(linkFrom(service.sentEmails[1].text, '/waitlist/confirm'))

    await runRetention(service.env, new Date(START.getTime() + 6 * 24 * 60 * 60 * 1000))
    expect(await rows()).toHaveLength(2)

    await runRetention(service.env, new Date(START.getTime() + 8 * 24 * 60 * 60 * 1000))
    expect(await rows()).toEqual([
      { email: 'grace@example.com', note: 'Team libraries', confirmedAt: START.toISOString() }
    ])
  })
})
