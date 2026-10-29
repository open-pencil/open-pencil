import { WAITLIST_TURNSTILE_ACTION, waitlistSignupSchema } from '#feedback/contract'
import { createFeedbackDatabase } from '#feedback/db'
import type { FeedbackEnv, FeedbackServices } from '#feedback/env'
import { rateLimited, validatedJSON } from '#feedback/http/request'
import { Hono, type Context } from 'hono'
import * as v from 'valibot'

import { confirmationEmail } from './email/confirmation'
import { actionPage, page } from './pages'
import { confirmSignup, leaveWaitlist, signUp } from './signup'
import { verifyTurnstile } from './turnstile'

const tokenSchema = v.pipe(v.string(), v.regex(/^[0-9a-f]{64}$/))

const CONFIRM_PATH = '/waitlist/confirm'
const LEAVE_PATH = '/waitlist/leave'

function linkTo(c: Context<FeedbackEnv>, path: string, token: string): string {
  const url = new URL(path, c.req.url)
  url.searchParams.set('token', token)
  return url.href
}

function queryToken(c: Context<FeedbackEnv>): string | null {
  const parsed = v.safeParse(tokenSchema, c.req.query('token'))
  return parsed.success ? parsed.output : null
}

async function formToken(c: Context<FeedbackEnv>): Promise<string | null> {
  const form = await c.req.parseBody()
  const parsed = v.safeParse(tokenSchema, form.token)
  return parsed.success ? parsed.output : null
}

const invalidLink = () =>
  page('Link expired', 'This link is no longer valid. Sign up again on openpencil.dev.')

export function waitlistRoutes(services: FeedbackServices) {
  return (
    new Hono<FeedbackEnv>()
      // Every accepted sign-up gets the same answer, so the form never reveals who is on the list.
      .post(
        '/waitlist',
        rateLimited((env) => env.WAITLIST_LIMITER),
        validatedJSON(waitlistSignupSchema),
        async (c) => {
          const signup = c.req.valid('json')
          const human = await verifyTurnstile(services.fetch, {
            secret: c.env.TURNSTILE_SECRET,
            token: signup.turnstileToken,
            hostnames: c.env.TURNSTILE_HOSTNAMES.split(',').map((hostname) => hostname.trim()),
            action: WAITLIST_TURNSTILE_ACTION
          })
          if (!human) return c.body(null, 403)
          const token = await signUp(createFeedbackDatabase(c.env.DB), signup, services.now())
          if (token) {
            await c.env.EMAIL.send({
              from: { name: 'OpenPencil', email: c.env.EMAIL_FROM },
              to: signup.email,
              ...(await confirmationEmail({
                confirmURL: linkTo(c, CONFIRM_PATH, token),
                leaveURL: linkTo(c, LEAVE_PATH, token)
              }))
            })
          }
          return c.body(null, 202)
        }
      )
      .get(CONFIRM_PATH, (c) => {
        const token = queryToken(c)
        if (!token) return c.html(invalidLink(), 404)
        return c.html(
          actionPage({
            title: 'Join the waitlist',
            message: 'Confirm your email to join the OpenPencil Cloud waitlist.',
            action: 'Confirm',
            token
          })
        )
      })
      .post(CONFIRM_PATH, async (c) => {
        const token = await formToken(c)
        const db = createFeedbackDatabase(c.env.DB)
        if (!token || !(await confirmSignup(db, token, services.now()))) {
          return c.html(invalidLink(), 404)
        }
        return c.html(
          page("You're on the list", 'We will write when OpenPencil Cloud is ready for you.')
        )
      })
      .get(LEAVE_PATH, (c) => {
        const token = queryToken(c)
        if (!token) return c.html(invalidLink(), 404)
        return c.html(
          actionPage({
            title: 'Leave the waitlist',
            message: 'Remove your email from the OpenPencil Cloud waitlist.',
            action: 'Remove my email',
            token
          })
        )
      })
      .post(LEAVE_PATH, async (c) => {
        const token = await formToken(c)
        if (token) await leaveWaitlist(createFeedbackDatabase(c.env.DB), token)
        return c.html(page('Removed', 'Your email is no longer on the waitlist.'))
      })
  )
}
