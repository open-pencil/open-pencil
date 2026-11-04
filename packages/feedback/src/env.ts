import type {
  D1Database,
  Fetcher,
  R2Bucket,
  R2PutOptions,
  RateLimit,
  SendEmail
} from '@cloudflare/workers-types/index'

/**
 * The report files bucket, as the Worker uses it. `put` takes a request body as it arrives, a
 * stream of declared length, which the Workers types spell as their own `ReadableStream`.
 */
export type ReportsBucket = Pick<R2Bucket, 'get' | 'head' | 'list' | 'delete'> & {
  put(key: string, value: ReadableStream | ArrayBuffer, options?: R2PutOptions): Promise<unknown>
}

/**
 * The Worker's bindings, from `wrangler.jsonc` and its secrets. They are declared here with
 * importable Workers types rather than taken from the generated global `Env`, so the app can
 * typecheck `FeedbackAPI` for its client without the Workers runtime globals; `src/index.ts`
 * checks that the two agree.
 */
export interface FeedbackBindings {
  DB: D1Database
  /** The metrics dashboard's built page, served only through the admin routes. */
  ASSETS: Fetcher
  EMAIL: SendEmail
  PING_LIMITER: RateLimit
  INGEST_LIMITER: RateLimit
  WAITLIST_LIMITER: RateLimit
  /** Counts report submissions and file uploads together. */
  REPORT_LIMITER: RateLimit
  /** Files people attach to error and problem reports, kept for `REPORT_FILE_RETENTION_DAYS`. */
  REPORTS: ReportsBucket
  /** Signs the short-lived token that lets a report's sender upload the files it declared. */
  REPORT_UPLOAD_SECRET: string
  POSTHOG_HOST: string
  POSTHOG_KEY: string
  EMAIL_FROM: string
  /** The sites whose Turnstile passes a sign-up accepts, separated by commas. */
  TURNSTILE_HOSTNAMES: string
  TURNSTILE_SECRET: string
  /** `owner/name` of the repository whose stars, downloads, and traffic are recorded. */
  GITHUB_REPOSITORY: string
  /** A fine-grained token that can read the repository's traffic (Administration: read). */
  GITHUB_TOKEN: string
  /** The Cloudflare zone holding `SITE_HOSTS`, for its visit analytics. */
  SITE_ZONE_ID: string
  /** The hostnames whose visits are recorded, separated by commas; the first is the website. */
  SITE_HOSTS: string
  /** A Cloudflare API token that can read the zone's analytics. */
  CLOUDFLARE_ANALYTICS_TOKEN: string
  /** The Zero Trust team domain that issues Access tokens, `https://<team>.cloudflareaccess.com`. */
  ACCESS_TEAM_DOMAIN: string
  /** The Access application's audience tag; a token for any other application is refused. */
  ACCESS_AUD: string
  /** PostHog's app host for its query API, which is not the ingestion host. */
  POSTHOG_APP_HOST: string
  POSTHOG_PROJECT_ID: string
  /** A PostHog personal API key limited to reading queries in that project. */
  POSTHOG_PERSONAL_KEY: string
}

export type FeedbackEnv = { Bindings: FeedbackBindings }

/** What the service reaches outside its bindings, injectable for tests. */
export interface FeedbackServices {
  fetch: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
  now: () => Date
}
