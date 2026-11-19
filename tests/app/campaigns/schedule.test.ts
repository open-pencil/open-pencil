import { describe, expect, test } from 'bun:test'

import * as v from 'valibot'

import { campaignSchema, type Campaign } from '@open-pencil/feedback/contract'

import {
  campaignActionURL,
  campaignContent,
  dueCampaign,
  type CampaignContext
} from '@/app/campaigns/schedule'

const DAY = 24 * 60 * 60 * 1000
const INSTALLED = Date.UTC(2026, 10, 1)

function campaign(fields: Partial<v.InferInput<typeof campaignSchema>> = {}): Campaign {
  return v.parse(campaignSchema, {
    id: 'try-cloud',
    kind: 'cloud',
    placement: 'prompt',
    content: { en: { title: 'Try Cloud', body: 'Sync your designs.' } },
    timing: { repeatAfterDays: 30, afterActionDays: null },
    ...fields
  })
}

function context(fields: Partial<CampaignContext> = {}): CampaignContext {
  return {
    now: INSTALLED + 10 * DAY,
    installedAt: INSTALLED,
    build: { version: '0.17.0', platform: 'macos', app: 'desktop' },
    cloud: 'signed-out',
    records: {},
    lastPromptAt: null,
    promptedThisLaunch: false,
    ...fields
  }
}

describe('campaign schedule', () => {
  test('shows a due campaign in its placement only', () => {
    const offer = campaign()
    expect(dueCampaign([offer], 'prompt', context())).toBe(offer)
    expect(dueCampaign([offer], 'share', context())).toBeNull()
  })

  test('waits the days after install it asks for', () => {
    const offer = campaign({
      timing: { afterInstallDays: 14, repeatAfterDays: 30, afterActionDays: null }
    })
    expect(dueCampaign([offer], 'prompt', context())).toBeNull()
    expect(dueCampaign([offer], 'prompt', context({ now: INSTALLED + 14 * DAY }))).toBe(offer)
  })

  test('comes back after Not now only when it repeats, and never after its action unless asked', () => {
    const offer = campaign()
    const now = INSTALLED + 40 * DAY
    const dismissed = { 'try-cloud': { dismissedAt: now - 10 * DAY } }
    expect(dueCampaign([offer], 'prompt', context({ now, records: dismissed }))).toBeNull()
    expect(
      dueCampaign([offer], 'prompt', context({ now: now + 20 * DAY, records: dismissed }))
    ).toBe(offer)
    const once = campaign({ timing: { repeatAfterDays: null, afterActionDays: null } })
    expect(
      dueCampaign([once], 'prompt', context({ now: now + 400 * DAY, records: dismissed }))
    ).toBeNull()
    const acted = { 'try-cloud': { actedAt: now } }
    expect(
      dueCampaign([offer], 'prompt', context({ now: now + 400 * DAY, records: acted }))
    ).toBeNull()
  })

  test('keeps to its audience', () => {
    const offer = campaign({
      audience: { apps: ['desktop'], minVersion: '0.17.0', cloud: 'signed-out' }
    })
    expect(dueCampaign([offer], 'prompt', context())).toBe(offer)
    expect(dueCampaign([offer], 'prompt', context({ cloud: 'signed-in' }))).toBeNull()
    const web = context({ build: { version: '0.17.0', platform: 'macos', app: 'web' } })
    expect(dueCampaign([offer], 'prompt', web)).toBeNull()
    const older = context({ build: { version: '0.16.9', platform: 'macos', app: 'desktop' } })
    expect(dueCampaign([offer], 'prompt', older)).toBeNull()
    const beta = context({ build: { version: '0.17.1-beta.2', platform: 'macos', app: 'desktop' } })
    expect(dueCampaign([offer], 'prompt', beta)).toBe(offer)
  })

  test('keeps to its dates', () => {
    const offer = campaign({
      startsAt: new Date(INSTALLED + 20 * DAY).toISOString(),
      endsAt: new Date(INSTALLED + 30 * DAY).toISOString()
    })
    expect(dueCampaign([offer], 'prompt', context())).toBeNull()
    expect(dueCampaign([offer], 'prompt', context({ now: INSTALLED + 25 * DAY }))).toBe(offer)
    expect(dueCampaign([offer], 'prompt', context({ now: INSTALLED + 30 * DAY }))).toBeNull()
  })

  test('shows the highest priority where several are due', () => {
    const low = campaign({ id: 'low' })
    const high = campaign({ id: 'high', priority: 5 })
    expect(dueCampaign([low, high], 'prompt', context())).toBe(high)
  })

  test('the prompt waits between campaigns and shows once a launch, whatever they ask', () => {
    const offer = campaign()
    const now = INSTALLED + 10 * DAY
    // A week, as the app promises, not read from the rule under test.
    const week = 7 * DAY
    expect(dueCampaign([offer], 'prompt', context({ promptedThisLaunch: true }))).toBeNull()
    expect(dueCampaign([offer], 'prompt', context({ lastPromptAt: now - week + 1 }))).toBeNull()
    expect(dueCampaign([offer], 'prompt', context({ lastPromptAt: now - week }))).toBe(offer)
    // Notes in a placement of their own are not prompts, so the gap does not hold them back.
    const note = campaign({ placement: 'share' })
    expect(dueCampaign([note], 'share', context({ promptedThisLaunch: true }))).toBe(note)
  })

  test('speaks the install language, or English', () => {
    const offer = campaign({
      content: {
        en: { title: 'Try Cloud', body: 'Sync.' },
        de: { title: 'Cloud testen', body: 'Synchronisieren.' }
      }
    })
    const { en, de } = offer.content
    if (!en || !de) throw new Error('The campaign is written in English and German')
    expect(campaignContent(offer, 'de')).toEqual(de)
    expect(campaignContent(offer, 'fr')).toEqual(en)
  })

  test("names the campaign in its action's link", () => {
    const offer = campaign({
      content: {
        en: {
          title: 'Try Cloud',
          body: 'Sync.',
          action: { label: 'Try', url: 'https://openpencil.dev/pricing?plan=pro' }
        }
      }
    })
    const { en } = offer.content
    if (!en) throw new Error('The campaign is written in English')
    const url = new URL(campaignActionURL(offer, en) ?? '')
    expect(url.searchParams.get('from')).toBe(offer.id)
    expect(url.searchParams.get('plan')).toBe('pro')
    expect(campaignActionURL(campaign(), { title: 'Try Cloud', body: 'Sync.' })).toBeNull()
  })
})
