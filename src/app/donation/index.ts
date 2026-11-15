import { ref } from 'vue'

import type { DonationSource } from '@open-pencil/feedback/contract'

import { appPreferences, updateDonationPreferences } from '@/app/settings/preferences/store'
import { openExternalLink } from '@/app/shell/ui'
import { trackUsage } from '@/app/telemetry'

const DAY = 24 * 60 * 60 * 1000
/** How long after the first launch the question first shows. */
export const FIRST_ASK_DELAY = 3 * DAY
/** How long Not now keeps it away. */
export const NOT_NOW_DELAY = 14 * DAY
/** How long it stays away once the person went to donate, which the app cannot confirm. */
export const DONATED_DELAY = 365 * DAY

/** The donation page `.github/FUNDING.yml` names; without one the app never asks or links. */
export const DONATION_URL: string | null =
  typeof __OPENPENCIL_DONATION_URL__ === 'string' ? __OPENPENCIL_DONATION_URL__ : null

/** Whether the donation question shows. */
export const donationPrompt = ref(false)

/**
 * Shows the question once it is due. The first time the app asks, it only starts the clock, so
 * the question waits `FIRST_ASK_DELAY` from the first launch.
 */
export function offerDonationPrompt(now = Date.now(), url = DONATION_URL): void {
  if (!url) return
  const { promptAfter } = appPreferences.value.donation
  if (promptAfter === null) {
    startDonationClock(now)
    return
  }
  if (now >= promptAfter) donationPrompt.value = true
}

/** Starts the clock on a launch that asks something else, such as the first-run welcome. */
export function startDonationClock(now = Date.now()): void {
  if (appPreferences.value.donation.promptAfter !== null) return
  updateDonationPreferences({ promptAfter: now + FIRST_ASK_DELAY })
}

/** Not now: asks again after `NOT_NOW_DELAY`. */
export function postponeDonation(now = Date.now()): void {
  updateDonationPreferences({ promptAfter: now + NOT_NOW_DELAY })
  donationPrompt.value = false
}

/** Records a choice to donate: the question stays away for a year, and shared stats count it. */
export function recordDonation(source: DonationSource, now = Date.now()): void {
  updateDonationPreferences({ promptAfter: now + DONATED_DELAY })
  donationPrompt.value = false
  trackUsage({ name: 'donate_clicked', source })
}

/** Opens the donation page in the browser. */
export function donate(source: DonationSource): void {
  if (!DONATION_URL) return
  recordDonation(source)
  void openExternalLink(DONATION_URL)
}
