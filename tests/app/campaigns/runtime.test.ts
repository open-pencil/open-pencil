import { beforeEach, describe, expect, test } from 'bun:test'

import * as v from 'valibot'

import { campaignSchema, type Campaign } from '@open-pencil/feedback/contract'

import {
  campaignsFor,
  dismissCampaign,
  offerCampaignPrompt,
  promptCampaign,
  promptedThisLaunch,
  recordCampaignAction,
  startCampaignClock
} from '@/app/campaigns'
import { appPreferences, DEFAULT_APP_PREFERENCES } from '@/app/settings/preferences/store'

const DAY = 24 * 60 * 60 * 1000
const URL = 'https://ko-fi.com/openpencil'
const FIRST_RUN = Date.UTC(2026, 10, 3)
const OWN = campaignsFor([], URL)

/** A new launch: the prompt has not shown, and nothing is on screen. */
function launch() {
  promptedThisLaunch.value = false
  promptCampaign.value = null
}

async function promptAt(now: number, available = OWN) {
  launch()
  await offerCampaignPrompt(now, available)
  return promptCampaign.value?.id ?? null
}

function served(fields: Partial<v.InferInput<typeof campaignSchema>>): Campaign {
  return v.parse(campaignSchema, {
    id: 'try-cloud',
    kind: 'cloud',
    placement: 'prompt',
    content: { en: { title: 'Try Cloud', body: 'Sync your designs.' } },
    timing: { repeatAfterDays: 30, afterActionDays: null },
    ...fields
  })
}

beforeEach(() => {
  appPreferences.value = structuredClone(DEFAULT_APP_PREFERENCES)
  launch()
})

describe('campaigns in the app', () => {
  test('a build without a donation page has no donation ask of its own', () => {
    expect(campaignsFor([], null)).toEqual([])
    expect(OWN.map((campaign) => campaign.id)).toEqual(['donation'])
  })

  test('the donation ask waits three days after the first run', async () => {
    startCampaignClock(FIRST_RUN)
    expect(await promptAt(FIRST_RUN + 3 * DAY - 1)).toBeNull()
    expect(await promptAt(FIRST_RUN + 3 * DAY)).toBe('donation')
  })

  test('Not now keeps it away two weeks, and Donate, from anywhere, a year', async () => {
    startCampaignClock(FIRST_RUN)
    const shown = FIRST_RUN + 3 * DAY
    await promptAt(shown)
    const ask = promptCampaign.value
    if (!ask) throw new Error('The donation ask shows')
    dismissCampaign(ask, 'prompt', shown)
    expect(promptCampaign.value).toBeNull()
    expect(await promptAt(shown + 14 * DAY - 1)).toBeNull()
    expect(await promptAt(shown + 14 * DAY)).toBe('donation')

    const donated = shown + 14 * DAY
    recordCampaignAction('donation', donated)
    expect(await promptAt(donated + 364 * DAY)).toBeNull()
    expect(await promptAt(donated + 365 * DAY)).toBe('donation')
  })

  test('carries the clock of builds before campaigns over, then clears it', async () => {
    const due = FIRST_RUN + 20 * DAY
    appPreferences.value.donation.promptAfter = due
    expect(await promptAt(due - 1)).toBeNull()
    expect(appPreferences.value.donation.promptAfter).toBeNull()
    expect(await promptAt(due)).toBe('donation')
  })

  test('shows one prompt a launch, and a week passes between prompts', async () => {
    startCampaignClock(FIRST_RUN)
    const cloud = served({ priority: 1 })
    const both = [...OWN, cloud]
    const now = FIRST_RUN + 10 * DAY
    expect(await promptAt(now, both)).toBe('try-cloud')
    // The same launch shows nothing more.
    await offerCampaignPrompt(now, both)
    expect(promptCampaign.value?.id).toBe('try-cloud')
    expect(await promptAt(now + 7 * DAY - 1, OWN)).toBeNull()
    expect(await promptAt(now + 7 * DAY, OWN)).toBe('donation')
  })

  test('a served campaign with the donation ask’s ID replaces it', () => {
    const replacement = served({ id: 'donation', kind: 'donation' })
    expect(campaignsFor([replacement], URL)).toEqual([replacement])
  })
})
