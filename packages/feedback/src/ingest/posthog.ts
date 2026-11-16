import type { Campaign, UsageBatch, UsageEvent } from '#feedback/contract'
import { omit } from 'es-toolkit'

/**
 * The batch's events PostHog is sent: a campaign event only while its campaign is still served,
 * so a campaign's ID is as closed a list as every other property, and with the campaign's kind,
 * which the Worker knows and the app need not send.
 */
export function servedEvents(
  events: UsageEvent[],
  campaigns: readonly Campaign[]
): (UsageEvent & { kind?: string })[] {
  const served = new Map(campaigns.map((campaign) => [campaign.id, campaign]))
  return events.flatMap((event): (UsageEvent & { kind?: string })[] => {
    if (!('campaign' in event)) return [event]
    const campaign = served.get(event.campaign)
    return campaign ? [{ ...event, kind: campaign.kind }] : []
  })
}

/**
 * PostHog's `/batch/` body for a usage batch. Events create no person profiles and skip GeoIP;
 * the request comes from the Worker, so PostHog never sees the client's address.
 */
export function toPostHogBatch(
  batch: UsageBatch,
  apiKey: string,
  campaigns: readonly Campaign[] = []
) {
  const { installId, events: sent, ...build } = batch
  const events = servedEvents(sent, campaigns)
  return {
    api_key: apiKey,
    batch: events.map((event) => ({
      event: event.name,
      timestamp: event.timestamp,
      distinct_id: installId,
      properties: {
        ...omit(event, ['name', 'timestamp']),
        ...build,
        $lib: 'openpencil',
        $process_person_profile: false,
        $geoip_disable: true
      }
    }))
  }
}
