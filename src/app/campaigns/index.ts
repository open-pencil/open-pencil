import { computed, shallowRef } from 'vue'

import type {
  BuiltInCampaignId,
  Campaign,
  CampaignContent,
  CampaignPlacement
} from '@open-pencil/feedback/contract'

import { cloudServers } from '@/app/cloud/servers/store'
import { DONATION_URL } from '@/app/donation/url'
import {
  appPreferences,
  updateCampaignPreferences,
  updateDonationPreferences
} from '@/app/settings/preferences/store'
import { openExternalLink } from '@/app/shell/ui'
import { trackUsage } from '@/app/telemetry'
import { currentBuild } from '@/app/telemetry/build'

import {
  campaignActionURL,
  dueCampaign,
  type CampaignContext,
  type ScheduledCampaign
} from './schedule'
import { servedCampaigns } from './served'

const DAY = 24 * 60 * 60 * 1000

/** A campaign the app ships with, which speaks the app's own translations. */
export type BuiltInCampaign = ScheduledCampaign & { id: BuiltInCampaignId }
export type AppCampaign = Campaign | BuiltInCampaign

/** The donation ask: three days after the first run, two weeks after Not now, a year after Donate. */
const DONATION: BuiltInCampaign = {
  id: 'donation',
  kind: 'donation',
  placement: 'prompt',
  priority: 0,
  timing: { afterInstallDays: 3, repeatAfterDays: 14, afterActionDays: 365 },
  audience: {}
}

export function isBuiltInCampaign(campaign: AppCampaign): campaign is BuiltInCampaign {
  return !('content' in campaign)
}

/**
 * The campaigns an install may show: the app's own, which a build includes only with a donation
 * page to send people to, and the served ones, which replace an own campaign with the same ID.
 */
export function campaignsFor(
  served: readonly Campaign[],
  donationURL: string | null
): AppCampaign[] {
  const servedIds = new Set(served.map((campaign) => campaign.id))
  const own = donationURL ? [DONATION] : []
  return [...own.filter((campaign) => !servedIds.has(campaign.id)), ...served]
}

/** This install's campaigns. */
export const campaigns = computed(() => campaignsFor(servedCampaigns.value, DONATION_URL))

/** The campaign the corner prompt shows, while it shows. */
export const promptCampaign = shallowRef<AppCampaign | null>(null)
/** Whether this launch showed a prompt, which it does once at most. */
export const promptedThisLaunch = shallowRef(false)

/** Starts the clock on the first run, which campaigns count their days after install from. */
export function startCampaignClock(now = Date.now()): void {
  if (appPreferences.value.campaigns.installedAt === null) {
    updateCampaignPreferences({ installedAt: now })
  }
}

/**
 * Carries the donation clock of builds before campaigns over once: the ask stays away until the
 * time it was due, as Not now that long before, and the install counts as past its first days.
 */
function carryDonationClockOver(now: number): void {
  const { promptAfter } = appPreferences.value.donation
  if (promptAfter === null) return
  const { records, installedAt } = appPreferences.value.campaigns
  updateCampaignPreferences({
    installedAt: installedAt ?? now - DONATION.timing.afterInstallDays * DAY,
    records: Object.hasOwn(records, 'donation')
      ? records
      : {
          ...records,
          donation: { dismissedAt: promptAfter - (DONATION.timing.repeatAfterDays ?? 0) * DAY }
        }
  })
  updateDonationPreferences({ promptAfter: null })
}

async function campaignContext(now: number): Promise<CampaignContext> {
  carryDonationClockOver(now)
  startCampaignClock(now)
  const { installedAt, lastPromptAt, records } = appPreferences.value.campaigns
  const signedIn = cloudServers.value.some(
    (server) => server.kind === 'official' && server.account !== null
  )
  return {
    now,
    installedAt: installedAt ?? now,
    build: await currentBuild(),
    cloud: signedIn ? 'signed-in' : 'signed-out',
    records,
    lastPromptAt,
    promptedThisLaunch: promptedThisLaunch.value
  }
}

function record(id: string, change: { dismissedAt?: number; actedAt?: number }): void {
  const { records } = appPreferences.value.campaigns
  updateCampaignPreferences({ records: { ...records, [id]: { ...records[id], ...change } } })
}

/** Shows the prompt's due campaign, if any, and counts it; once a launch at most. */
export async function offerCampaignPrompt(
  now = Date.now(),
  available: readonly AppCampaign[] = campaigns.value
): Promise<void> {
  const due = dueCampaign(available, 'prompt', await campaignContext(now))
  if (!due) return
  promptedThisLaunch.value = true
  updateCampaignPreferences({ lastPromptAt: now })
  promptCampaign.value = due
  trackUsage({ name: 'campaign_shown', campaign: due.id, placement: 'prompt' })
}

/** Not now, or closed: the campaign comes back as its timing says. */
export function dismissCampaign(
  campaign: AppCampaign,
  placement: CampaignPlacement,
  now = Date.now()
): void {
  record(campaign.id, { dismissedAt: now })
  if (promptCampaign.value?.id === campaign.id) promptCampaign.value = null
  trackUsage({ name: 'campaign_dismissed', campaign: campaign.id, placement })
}

/** Records that the campaign's action was followed, from wherever, without counting it. */
export function recordCampaignAction(id: string, now = Date.now()): void {
  record(id, { actedAt: now })
  if (promptCampaign.value?.id === id) promptCampaign.value = null
}

/**
 * Follows the campaign's action: the app's own campaigns open their page, a served one its link
 * named by the campaign.
 */
export function actOnCampaign(
  campaign: AppCampaign,
  placement: CampaignPlacement,
  content: CampaignContent,
  now = Date.now()
): void {
  const url = isBuiltInCampaign(campaign)
    ? content.action?.url
    : campaignActionURL(campaign, content)
  recordCampaignAction(campaign.id, now)
  trackUsage({ name: 'campaign_acted', campaign: campaign.id, placement })
  if (url) void openExternalLink(url)
}
