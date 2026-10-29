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

/** The D1 tables `migrations/` creates, in Kysely's camelCase. */
export interface FeedbackDatabase {
  usagePings: UsagePingTable
  waitlist: WaitlistTable
  githubStars: GithubStarsTable
  releaseDownloads: ReleaseDownloadsTable
  repoTraffic: RepoTrafficTable
  repoReferrers: RepoReferrersTable
  siteVisits: SiteVisitsTable
  sitePages: SitePagesTable
  siteCountries: SiteCountriesTable
  repoItems: RepoItemTable
}
