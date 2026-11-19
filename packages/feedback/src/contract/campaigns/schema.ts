import * as v from 'valibot'

import { APP_KINDS, CAMPAIGN_PLACEMENTS, campaignIdSchema, LOCALES, PLATFORMS } from '../schema'

/** Hosts a campaign may link to: openpencil.dev and its subdomains, over HTTPS. */
export function isCampaignLink(value: string): boolean {
  if (!URL.canParse(value)) return false
  const { protocol, hostname } = new URL(value)
  return (
    protocol === 'https:' && (hostname === 'openpencil.dev' || hostname.endsWith('.openpencil.dev'))
  )
}

const campaignLinkSchema = v.pipe(
  v.string(),
  v.maxLength(500),
  v.check(isCampaignLink, 'Campaigns link only to openpencil.dev over HTTPS')
)

/** What a campaign says in one language. The body is Markdown, which the app renders as text. */
export const campaignContentSchema = v.strictObject({
  title: v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(80)),
  body: v.pipe(v.string(), v.maxLength(1_000)),
  action: v.optional(
    v.strictObject({
      label: v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(40)),
      url: campaignLinkSchema
    })
  )
})
export type CampaignContent = v.InferOutput<typeof campaignContentSchema>

const daysSchema = v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(3_650))
const versionSchema = v.pipe(v.string(), v.regex(/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.]+)?$/))

/**
 * One campaign: what to say where, how often, and to whom. The app keeps its own limits on top of
 * these (`src/app/campaigns`), so a campaign can show less often than it asks, never more.
 */
export const campaignSchema = v.strictObject({
  id: campaignIdSchema,
  /** What it is about, such as `donation` or `cloud`, for counting what people act on. */
  kind: campaignIdSchema,
  /** A placement this build may not know; it then ignores the campaign. */
  placement: v.pipe(v.string(), v.maxLength(64)),
  /** Higher shows first where two campaigns are due in one placement. */
  priority: v.optional(v.pipe(v.number(), v.integer()), 0),
  /** English is required, as every other language falls back to it. */
  content: v.pipe(
    v.record(v.picklist(LOCALES), campaignContentSchema),
    v.check((content) => content.en !== undefined, 'A campaign is written in English at least')
  ),
  timing: v.strictObject({
    /** Days after the install first ran before the campaign shows. */
    afterInstallDays: v.optional(daysSchema, 0),
    /** Days after Not now before it shows again; `null` shows it once. */
    repeatAfterDays: v.nullable(daysSchema),
    /** Days after the person followed its action before it shows again; `null` never again. */
    afterActionDays: v.nullable(daysSchema)
  }),
  audience: v.optional(
    v.strictObject({
      apps: v.optional(v.array(v.picklist(APP_KINDS))),
      platforms: v.optional(v.array(v.picklist(PLATFORMS))),
      minVersion: v.optional(versionSchema),
      maxVersion: v.optional(versionSchema),
      /** Whether the install is signed in to OpenPencil Cloud. */
      cloud: v.optional(v.picklist(['signed-in', 'signed-out']))
    }),
    {}
  ),
  startsAt: v.optional(v.pipe(v.string(), v.isoTimestamp())),
  endsAt: v.optional(v.pipe(v.string(), v.isoTimestamp()))
})
export type Campaign = v.InferOutput<typeof campaignSchema>

/**
 * What the ping answers. Each campaign is read on its own (`readCampaigns`), so one this build
 * cannot read is dropped without losing the rest.
 */
export const pingAnswerSchema = v.object({ campaigns: v.array(v.unknown()) })
export type PingAnswer = v.InferOutput<typeof pingAnswerSchema>

/** The campaigns of a ping's answer this build can read, for placements it has. */
export function readCampaigns(answer: PingAnswer): Campaign[] {
  const placements: readonly string[] = CAMPAIGN_PLACEMENTS
  return answer.campaigns.flatMap((item) => {
    const parsed = v.safeParse(campaignSchema, item)
    return parsed.success && placements.includes(parsed.output.placement) ? [parsed.output] : []
  })
}
