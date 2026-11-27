export interface UsagePingTable {
  day: string
  version: string
  platform: string
  arch: string
  app: string
  browser: string
  usageStats: string
  /** 1 for pings that sent their step, 0 for those from versions that send none. */
  stepped: number
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
  /** The author's GitHub login; `null` for bots and for items not synced since it was added. */
  author: string | null
  createdAt: string
  closedAt: string | null
  mergedAt: string | null
  updatedAt: string
}

export interface CloudUsageTable {
  day: string
  signUps: number
  activeAccounts: number
  documentsCreated: number
  revisions: number
  /** Totals at the end of the day; `null` on days filled in from Cloud's records. */
  accounts: number | null
  documents: number | null
  workspaces: number | null
  storageBytes: number | null
}

export interface NpmDownloadsTable {
  day: string
  package: string
  downloads: number
}

/** The D1 tables `migrations/` creates, in Kysely's camelCase. */
export interface FeedbackDatabase {
  usagePings: UsagePingTable
  pingNetworks: PingNetworkTable
  pingSteps: PingStepTable
  githubStars: GithubStarsTable
  releaseDownloads: ReleaseDownloadsTable
  repoTraffic: RepoTrafficTable
  repoReferrers: RepoReferrersTable
  siteVisits: SiteVisitsTable
  sitePages: SitePagesTable
  siteCountries: SiteCountriesTable
  repoItems: RepoItemTable
  cloudUsage: CloudUsageTable
  npmDownloads: NpmDownloadsTable
}
