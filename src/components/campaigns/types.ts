import type { CampaignContent } from '@open-pencil/feedback/contract'

/** What a campaign's prompt or note shows. */
export type CampaignView = {
  content: CampaignContent
  /** What the campaign is about, such as `donation` or `cloud`, which picks its icon. */
  kind?: string
}

/** A campaign's prompt or note as its stories take it: what it shows, and its two buttons. */
export type CampaignViewArgs = CampaignView & { onDismiss: () => void; onAct: () => void }
