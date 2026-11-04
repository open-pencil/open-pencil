import type { FeedbackEnv, FeedbackServices } from '#feedback/env'
import { createMiddleware } from 'hono/factory'
import { createLocalJWKSet, jwtVerify, type JSONWebKeySet } from 'jose'
import * as v from 'valibot'

const CERTS_TIMEOUT_MS = 10_000
// Cloudflare rotates the signing key every six weeks and publishes the next one in advance, so
// a short cache never misses a rotation for long.
const CERTS_TTL_MS = 10 * 60 * 1000

const certsSchema = v.object({
  keys: v.array(v.looseObject({ kty: v.string(), kid: v.optional(v.string()) }))
})

/**
 * Lets a request through only with a valid Cloudflare Access token for the admin application.
 * Access already blocks everyone else at Cloudflare's edge; checking the token here as well means
 * a misconfigured route or a request that bypasses Access still gets nothing.
 */
export function requireAccess(services: FeedbackServices) {
  let cached: { team: string; keys: JSONWebKeySet; fetchedAt: number } | undefined

  async function keysFor(team: string): Promise<JSONWebKeySet> {
    const now = services.now().getTime()
    if (cached?.team === team && now - cached.fetchedAt < CERTS_TTL_MS) return cached.keys
    const response = await services.fetch(`${team}/cdn-cgi/access/certs`, {
      signal: AbortSignal.timeout(CERTS_TIMEOUT_MS)
    })
    if (!response.ok) throw new Error(`Access certificates answered ${response.status}`)
    const parsed = v.safeParse(
      v.pipe(v.string(), v.parseJson(), certsSchema),
      await response.text()
    )
    if (!parsed.success) throw new Error('Access certificates have an unexpected shape')
    cached = { team, keys: parsed.output, fetchedAt: now }
    return parsed.output
  }

  return createMiddleware<FeedbackEnv>(async (c, next) => {
    const token = c.req.header('cf-access-jwt-assertion')
    const team = c.env.ACCESS_TEAM_DOMAIN
    if (!token || !team || !c.env.ACCESS_AUD) return c.body(null, 403)
    try {
      await jwtVerify(token, createLocalJWKSet(await keysFor(team)), {
        issuer: team,
        audience: c.env.ACCESS_AUD,
        currentDate: services.now(),
        // jose checks `exp` only when a token has one; Access always sets it, so one without is refused.
        requiredClaims: ['exp']
      })
    } catch (error) {
      console.warn('Admin request refused', { error: String(error) })
      return c.body(null, 403)
    }
    return next()
  })
}
