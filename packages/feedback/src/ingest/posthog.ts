import type { UsageBatch } from '#feedback/contract'
import { omit } from 'es-toolkit'

/**
 * PostHog's `/batch/` body for a usage batch. Events create no person profiles and skip GeoIP;
 * the request comes from the Worker, so PostHog never sees the client's address.
 */
export function toPostHogBatch(batch: UsageBatch, apiKey: string) {
  const { installId, events, ...build } = batch
  return {
    api_key: apiKey,
    batch: events.map((event) => ({
      event: event.name,
      timestamp: event.timestamp,
      distinct_id: installId,
      properties: {
        ...omit(event, ['name', 'timestamp']),
        ...build,
        $lib: 'lawha',
        $process_person_profile: false,
        $geoip_disable: true
      }
    }))
  }
}
