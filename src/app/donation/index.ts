import type { DonationSource } from '@open-pencil/feedback/contract'

import { recordCampaignAction } from '@/app/campaigns'
import { openExternalLink } from '@/app/shell/ui'
import { trackUsage } from '@/app/telemetry'

import { DONATION_URL } from './url'

export { DONATION_URL }

/**
 * Opens the donation page from the File menu or Settings. It counts as following the donation
 * ask, which then stays away as long as it would after its own Donate.
 */
export function donate(source: DonationSource): void {
  if (!DONATION_URL) return
  recordCampaignAction('donation')
  trackUsage({ name: 'donate_clicked', source })
  void openExternalLink(DONATION_URL)
}
