import { beforeEach, describe, expect, test } from 'bun:test'

import { appPreferences, DEFAULT_APP_PREFERENCES } from '@/app/settings/preferences/store'
import { offerUsageStatsPrompt, setUsageStatsConsent, usageStatsPrompt } from '@/app/telemetry'
import { sharingState } from '@/app/telemetry/state'

beforeEach(() => {
  appPreferences.value = structuredClone(DEFAULT_APP_PREFERENCES)
  sharingState.value = { installId: null, lastPingDay: null, pingDays: 0 }
})

describe('usage stats consent', () => {
  test('agreeing makes a random install ID that stays across answers', () => {
    setUsageStatsConsent(true, 'welcome')
    const { installId } = sharingState.value

    expect(appPreferences.value.sharing.usageStats).toBe('granted')
    expect(installId).toMatch(/^[0-9a-f]{32}$/)
    setUsageStatsConsent(true, 'welcome')
    expect(sharingState.value.installId).toBe(installId)
  })

  test('stopping deletes the install ID, so agreeing again starts a new one', () => {
    setUsageStatsConsent(true, 'welcome')
    const first = sharingState.value.installId
    setUsageStatsConsent(false, 'welcome')

    expect(appPreferences.value.sharing.usageStats).toBe('denied')
    expect(sharingState.value.installId).toBeNull()
    setUsageStatsConsent(true, 'welcome')
    expect(sharingState.value.installId).not.toBe(first)
  })

  test('a build that sends nothing never asks', () => {
    offerUsageStatsPrompt('welcome')
    expect(usageStatsPrompt.value).toBeNull()
  })
})
