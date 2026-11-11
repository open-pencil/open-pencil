import type { Generated } from 'kysely'

export interface UsagePingTable {
  day: string
  version: string
  platform: string
  arch: string
  app: string
  browser: string
  usageStats: string
  count: number
}

export interface PingNetworkTable {
  day: string
  asn: number
  app: string
  platform: string
  name: string
  count: number
}

export interface PingStepTable {
  day: string
  app: string
  step: string
  /** 1 for pings that moved an install into the step, 0 for the rest. */
  entered: number
  count: number
}

export interface WaitlistTable {
  id: Generated<number>
  email: string
  emailKey: string
  note: string | null
  token: string
  createdAt: string
  confirmationSentAt: string
  confirmedAt: string | null
}

export interface GithubStarsTable {
  day: string
  stars: number
  forks: number
}

export interface ReleaseDownloadsTable {
  day: string
  tag: string
  kind: string
  downloads: number
}

export interface RepoTrafficTable {
  day: string
  views: number
  uniqueViews: number
  clones: number
  uniqueClones: number
}

export interface RepoReferrersTable {
  day: string
  referrer: string
  views: number
  uniqueViews: number
}

export interface SiteVisitsTable {
  day: string
  host: string
  visits: number
}

export interface SitePagesTable {
  day: string
  path: string
  visits: number
}

export interface SiteCountriesTable {
  day: string
  country: string
  visits: number
}

export interface RepoItemTable {
  number: number
  kind: 'issue' | 'pull'
  authorAssociation: string
  createdAt: string
  closedAt: string | null
  mergedAt: string | null
  updatedAt: string
}

export interface ReportTriageTable {
  reportId: string
  status: 'open' | 'replied' | 'closed'
  note: string | null
  handledBy: string
  handledAt: string
}

/** The D1 tables `migrations/` creates, in Kysely's camelCase. */
export interface FeedbackDatabase {
  usagePings: UsagePingTable
  pingNetworks: PingNetworkTable
  pingSteps: PingStepTable
  waitlist: WaitlistTable
  githubStars: GithubStarsTable
  releaseDownloads: ReleaseDownloadsTable
  repoTraffic: RepoTrafficTable
  repoReferrers: RepoReferrersTable
  siteVisits: SiteVisitsTable
  sitePages: SitePagesTable
  siteCountries: SiteCountriesTable
  repoItems: RepoItemTable
  reportTriage: ReportTriageTable
}
