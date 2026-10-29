import type { FeedbackServices } from '#feedback/env'
import { type CalendarDate, parseDate } from '@internationalized/date'
import * as v from 'valibot'

const GRAPHQL_URL = 'https://api.cloudflare.com/client/v4/graphql'
const REQUEST_TIMEOUT_MS = 15_000
/** How many of the website's pages a day keeps; the long tail is one-off paths and scanners. */
export const TOP_PAGES = 50
/** More than there are countries, so a day keeps all of them. */
const COUNTRIES = 300

// Visits from people's browsers only: `eyeball` leaves out Cloudflare's own Workers and checks.
const VISITS_QUERY = `query ($zone: String!, $start: Date!, $end: Date!, $hosts: [String!]) {
  viewer { zones(filter: { zoneTag: $zone }) {
    httpRequestsAdaptiveGroups(
      limit: 10000
      filter: { date_geq: $start, date_leq: $end, requestSource: "eyeball", clientRequestHTTPHost_in: $hosts }
    ) { sum { visits } dimensions { date clientRequestHTTPHost } }
  } }
}`

const BREAKDOWN_QUERY = `query ($zone: String!, $day: Date!, $host: String!, $pages: Int!, $countries: Int!) {
  viewer { zones(filter: { zoneTag: $zone }) {
    pages: httpRequestsAdaptiveGroups(
      limit: $pages
      orderBy: [sum_visits_DESC]
      filter: { date: $day, requestSource: "eyeball", clientRequestHTTPHost: $host }
    ) { sum { visits } dimensions { clientRequestPath } }
    countries: httpRequestsAdaptiveGroups(
      limit: $countries
      orderBy: [sum_visits_DESC]
      filter: { date: $day, requestSource: "eyeball", clientRequestHTTPHost: $host }
    ) { sum { visits } dimensions { clientCountryName } }
  } }
}`

const visitsSchema = v.object({ visits: v.number() })
const answer = <T extends v.GenericSchema>(zone: T) =>
  v.object({
    data: v.nullable(v.object({ viewer: v.object({ zones: v.array(zone) }) })),
    errors: v.nullish(v.array(v.object({ message: v.string() })))
  })
const visitsZoneSchema = v.object({
  httpRequestsAdaptiveGroups: v.array(
    v.object({
      sum: visitsSchema,
      dimensions: v.object({ date: v.string(), clientRequestHTTPHost: v.string() })
    })
  )
})
const breakdownZoneSchema = v.object({
  pages: v.array(
    v.object({ sum: visitsSchema, dimensions: v.object({ clientRequestPath: v.string() }) })
  ),
  countries: v.array(
    v.object({ sum: visitsSchema, dimensions: v.object({ clientCountryName: v.string() }) })
  )
})

/** Cloudflare's GraphQL analytics for one zone; a failed or unexpected answer throws. */
export function cloudflareClient(fetcher: FeedbackServices['fetch'], zone: string, token: string) {
  async function query<T extends v.GenericSchema>(
    zoneSchema: T,
    text: string,
    variables: Record<string, unknown>
  ): Promise<v.InferOutput<T>> {
    const schema = answer(zoneSchema)
    const response = await fetcher(GRAPHQL_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: text, variables: { zone, ...variables } }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
    })
    if (!response.ok) throw new Error(`Cloudflare analytics answered ${response.status}`)
    const result = v.safeParse(v.pipe(v.string(), v.parseJson(), schema), await response.text())
    if (!result.success) throw new Error('Cloudflare analytics sent an unexpected answer')
    const first = result.output.errors?.at(0)
    if (first) throw new Error(`Cloudflare analytics refused the query: ${first.message}`)
    const [zoneData] = result.output.data?.viewer.zones ?? []
    if (!zoneData) throw new Error('Cloudflare analytics returned no data for the zone')
    return zoneData
  }

  return {
    /** Visits per day and hostname from `start` to `end`, both included. */
    async visits(start: CalendarDate, end: CalendarDate, hosts: string[]) {
      const zoneData = await query(visitsZoneSchema, VISITS_QUERY, {
        start: start.toString(),
        end: end.toString(),
        hosts
      })
      return zoneData.httpRequestsAdaptiveGroups.map((group) => ({
        // Parsed rather than copied, so a malformed date fails the run instead of being stored.
        day: parseDate(group.dimensions.date).toString(),
        host: group.dimensions.clientRequestHTTPHost,
        visits: group.sum.visits
      }))
    },

    /** One day of a host's most visited pages and its visits by country. */
    async breakdown(date: CalendarDate, host: string) {
      const day = date.toString()
      const zoneData = await query(breakdownZoneSchema, BREAKDOWN_QUERY, {
        day,
        host,
        pages: TOP_PAGES,
        countries: COUNTRIES
      })
      return {
        pages: zoneData.pages
          .filter((group) => group.sum.visits > 0)
          .map((group) => ({
            day,
            path: group.dimensions.clientRequestPath,
            visits: group.sum.visits
          })),
        countries: zoneData.countries
          .filter((group) => group.sum.visits > 0)
          .map((group) => ({
            day,
            country: group.dimensions.clientCountryName,
            visits: group.sum.visits
          }))
      }
    }
  }
}
