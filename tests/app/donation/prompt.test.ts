import { beforeEach, expect, test } from 'bun:test'

import {
  DONATED_DELAY,
  donationPrompt,
  FIRST_ASK_DELAY,
  NOT_NOW_DELAY,
  offerDonationPrompt,
  postponeDonation,
  recordDonation,
  startDonationClock
} from '@/app/donation'
import { appPreferences, DEFAULT_APP_PREFERENCES } from '@/app/settings/preferences/store'

const URL = 'https://ko-fi.com/openpencil'
const NOW = Date.UTC(2026, 10, 3)

beforeEach(() => {
  appPreferences.value = structuredClone(DEFAULT_APP_PREFERENCES)
  donationPrompt.value = false
})

test('the first launch starts the clock, and the question shows once it runs out', () => {
  offerDonationPrompt(NOW, URL)
  expect(donationPrompt.value).toBe(false)
  expect(appPreferences.value.donation.promptAfter).toBe(NOW + FIRST_ASK_DELAY)

  offerDonationPrompt(NOW + FIRST_ASK_DELAY - 1, URL)
  expect(donationPrompt.value).toBe(false)
  offerDonationPrompt(NOW + FIRST_ASK_DELAY, URL)
  expect(donationPrompt.value).toBe(true)
})

test('a launch that asks something else still starts the clock, once', () => {
  startDonationClock(NOW)
  startDonationClock(NOW + 1000)
  expect(appPreferences.value.donation.promptAfter).toBe(NOW + FIRST_ASK_DELAY)
})

test('Not now and donating keep the question away for their own times', () => {
  donationPrompt.value = true
  postponeDonation(NOW)
  expect(donationPrompt.value).toBe(false)
  expect(appPreferences.value.donation.promptAfter).toBe(NOW + NOT_NOW_DELAY)

  recordDonation('menu', NOW)
  expect(appPreferences.value.donation.promptAfter).toBe(NOW + DONATED_DELAY)
})

test('a build without a donation page never asks', () => {
  appPreferences.value.donation.promptAfter = 0
  offerDonationPrompt(NOW, null)
  expect(donationPrompt.value).toBe(false)
})
