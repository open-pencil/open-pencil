import { afterAll, beforeAll, describe, expect, test } from 'bun:test'

import { createTestService, type TestService } from '#feedback-tests/harness'
import { CAMPAIGNS } from '#feedback/campaigns/catalog'
import {
  campaignSchema,
  isCampaignLink,
  pingAnswerSchema,
  readCampaigns,
  type Campaign,
  type Ping
} from '#feedback/contract'
import * as v from 'valibot'

const BUILD: Ping = {
  version: '0.17.0',
  platform: 'macos',
  arch: 'arm64',
  app: 'desktop',
  browser: 'unknown',
  usageStats: 'unset'
}

const CLOUD: Campaign = v.parse(campaignSchema, {
  id: 'try-cloud',
  kind: 'cloud',
  placement: 'settings-models',
  content: {
    en: {
      title: 'No API key?',
      body: 'Use OpenPencil AI with **Cloud** credits.',
      action: { label: 'Try Cloud', url: 'https://openpencil.dev/pricing' }
    }
  },
  timing: { repeatAfterDays: 30, afterActionDays: null }
})

let service: TestService

beforeAll(async () => {
  service = await createTestService()
})

afterAll(async () => {
  await service.dispose()
})

describe('campaigns', () => {
  test('a ping answers with the campaigns the app can read', async () => {
    service.services.campaigns = [CLOUD]
    try {
      const response = await service.client.ping.$post({ json: BUILD })
      expect(response.status).toBe(200)
      const answer = v.parse(pingAnswerSchema, await response.json())
      expect(readCampaigns(answer)).toEqual([CLOUD])
    } finally {
      service.services.campaigns = undefined
    }
  })

  test('the shipped catalog reads through the contract', () => {
    expect(v.parse(v.array(campaignSchema), CAMPAIGNS)).toEqual([...CAMPAIGNS])
  })

  test('the app keeps the campaigns it can read and drops the rest', () => {
    const answer = {
      campaigns: [
        CLOUD,
        { ...CLOUD, id: 'later', placement: 'a-placement-from-a-later-build' },
        { ...CLOUD, id: 'broken', content: { de: CLOUD.content.en } },
        'not a campaign'
      ]
    }
    expect(readCampaigns(answer).map((campaign) => campaign.id)).toEqual(['try-cloud'])
  })

  test('campaigns link only to openpencil.dev over HTTPS', () => {
    expect(isCampaignLink('https://openpencil.dev/pricing')).toBe(true)
    expect(isCampaignLink('https://billing.openpencil.dev/')).toBe(true)
    expect(isCampaignLink('http://openpencil.dev/')).toBe(false)
    expect(isCampaignLink('https://openpencil.dev.evil.test/')).toBe(false)
    expect(isCampaignLink('ftp://openpencil.dev/')).toBe(false)
    const elsewhere = {
      ...CLOUD,
      content: { en: { ...CLOUD.content.en, action: { label: 'Go', url: 'https://evil.test/' } } }
    }
    expect(v.safeParse(campaignSchema, elsewhere).success).toBe(false)
  })
})
