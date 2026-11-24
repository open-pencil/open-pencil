import { oc, type ErrorMap } from '@orpc/contract'
import * as v from 'valibot'

import { staticEntitlementsSchema } from '../entitlements'
import { at } from './route'

/** An account the internal API acts on, named by its UUID. */
const accountParamsSchema = v.object({ userId: v.pipe(v.string(), v.uuid(), v.toLowerCase()) })

/** A plan a service that decides entitlements, such as billing, sets for an account. */
export const setAccountEntitlementsSchema = v.object({
  values: staticEntitlementsSchema,
  /** Who decided these values, such as `billing`; stored as the row's source. */
  source: v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(64)),
  /** Increases with every decision the writer makes, such as a billing event's timestamp. */
  externalVersion: v.pipe(v.number(), v.safeInteger(), v.minValue(0))
})

const route = oc.errors({ not_found: {}, invalid_request: {} } satisfies ErrorMap)

/**
 * What the deployment's own services, such as billing, ask of Cloud under `/api/internal`, with the
 * internal API's bearer token: setting an account's plan, and counting the seats it pays for.
 */
export const internalContract = {
  setAccountEntitlements: route
    .meta(at('PUT', '/accounts/{userId}/entitlements'))
    .input(v.object({ params: accountParamsSchema, body: setAccountEntitlementsSchema }))
    .output(v.object({ applied: v.boolean() })),
  accountSeats: route
    .meta(at('GET', '/accounts/{userId}/seats'))
    .input(v.object({ params: accountParamsSchema }))
    .output(v.object({ seats: v.pipe(v.number(), v.integer(), v.minValue(0)) }))
}
