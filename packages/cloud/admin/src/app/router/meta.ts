import * as v from 'valibot'
import type { RouteLocationNormalizedLoaded } from 'vue-router'

export const cloudRouteIndexingSchema = v.picklist(['public', 'private'])
export const cloudHeadKeySchema = v.picklist([
  'home',
  'signIn',
  'signUp',
  'pending',
  'rejected',
  'revoked',
  'dashboard',
  'notFound',
  'enrollment',
  'users',
  'email',
  'audit',
  'operations',
  'forbidden'
])
const cloudRouteMetaSchema = v.object({
  headKey: cloudHeadKeySchema,
  indexing: cloudRouteIndexingSchema
})

export type CloudRouteIndexing = v.InferOutput<typeof cloudRouteIndexingSchema>
export type CloudHeadKey = v.InferOutput<typeof cloudHeadKeySchema>
export type CloudRouteMeta = v.InferOutput<typeof cloudRouteMetaSchema>

declare module 'vue-router' {
  interface RouteMeta {
    headKey: CloudHeadKey
    indexing: CloudRouteIndexing
  }
}

const DEFAULT_ROUTE_META: CloudRouteMeta = {
  headKey: 'home',
  indexing: 'private'
}

export function routeMeta(route: RouteLocationNormalizedLoaded): CloudRouteMeta {
  const parsed = v.safeParse(cloudRouteMetaSchema, route.meta)
  return parsed.success ? parsed.output : DEFAULT_ROUTE_META
}
