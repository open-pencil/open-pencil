import { compact, maxBy } from 'es-toolkit'
import { satisfies } from 'semver'
import { withQuery } from 'ufo'

import type {
  Build,
  Campaign,
  CampaignContent,
  CampaignPlacement
} from '@open-pencil/feedback/contract'

import type { CampaignRecordPreferences } from '@/app/settings/preferences/store'

const DAY = 24 * 60 * 60 * 1000

/**
 * The least time between two prompts, whatever the campaigns ask: the app's own limit, so a
 * server that asked too often still could not turn the prompt into nagging.
 */
export const PROMPT_GAP = 7 * DAY

/**
 * What scheduling reads of a campaign: everything but what it says. The app's own campaigns,
 * which speak its translations, have no text of their own.
 */
export type ScheduledCampaign = Omit<Campaign, 'content'>

/** What a campaign's audience and timing are checked against. */
export type CampaignContext = {
  now: number
  /** When the install first ran. */
  installedAt: number
  build: Pick<Build, 'version' | 'platform' | 'app'>
  cloud: 'signed-in' | 'signed-out'
  /** What the install did with each campaign, kept on the device and never sent. */
  records: Readonly<Record<string, CampaignRecordPreferences>>
  /** When any campaign last showed as a prompt, and whether one has this launch. */
  lastPromptAt: number | null
  promptedThisLaunch: boolean
}

function inAudience(campaign: ScheduledCampaign, { build, cloud }: CampaignContext): boolean {
  const { apps, platforms, minVersion, maxVersion, cloud: wanted } = campaign.audience
  if (apps && !apps.includes(build.app)) return false
  if (platforms && !platforms.includes(build.platform)) return false
  const range = compact([minVersion && `>=${minVersion}`, maxVersion && `<=${maxVersion}`]).join(
    ' '
  )
  if (range && !satisfies(build.version, range, { includePrerelease: true })) return false
  return !wanted || wanted === cloud
}

function isDue(
  campaign: ScheduledCampaign,
  { now, installedAt, records }: CampaignContext
): boolean {
  if (campaign.startsAt && now < Date.parse(campaign.startsAt)) return false
  if (campaign.endsAt && now >= Date.parse(campaign.endsAt)) return false
  const { afterInstallDays, repeatAfterDays, afterActionDays } = campaign.timing
  if (now < installedAt + afterInstallDays * DAY) return false
  const { dismissedAt, actedAt } = records[campaign.id] ?? {}
  if (
    actedAt !== undefined &&
    (afterActionDays === null || now < actedAt + afterActionDays * DAY)
  ) {
    return false
  }
  if (
    dismissedAt !== undefined &&
    (repeatAfterDays === null || now < dismissedAt + repeatAfterDays * DAY)
  ) {
    return false
  }
  return true
}

/**
 * The campaign `placement` shows now, or `null`: one whose audience includes this install and
 * whose timing is due, the highest priority first. The prompt also waits `PROMPT_GAP` after the
 * last prompt of any campaign, and shows at most once a launch.
 */
export function dueCampaign<TCampaign extends ScheduledCampaign>(
  campaigns: readonly TCampaign[],
  placement: CampaignPlacement,
  context: CampaignContext
): TCampaign | null {
  if (placement === 'prompt') {
    if (context.promptedThisLaunch) return null
    if (context.lastPromptAt !== null && context.now < context.lastPromptAt + PROMPT_GAP)
      return null
  }
  const due = campaigns.filter(
    (campaign) =>
      campaign.placement === placement && inAudience(campaign, context) && isDue(campaign, context)
  )
  return maxBy(due, (campaign) => campaign.priority) ?? null
}

/** What `campaign` says in `locale`, or in English, which every campaign has. */
export function campaignContent(campaign: Campaign, locale: string): CampaignContent {
  const content: Partial<Record<string, CampaignContent>> = campaign.content
  const english = campaign.content.en
  if (!english) throw new Error(`Campaign ${campaign.id} has no English`)
  return content[locale] ?? english
}

/**
 * Where the campaign's action leads, named by the campaign in `from`, so the site's visit counts
 * show which campaign brought someone even from installs that share no usage stats.
 */
export function campaignActionURL(campaign: Campaign, content: CampaignContent): string | null {
  return content.action ? withQuery(content.action.url, { from: campaign.id }) : null
}
