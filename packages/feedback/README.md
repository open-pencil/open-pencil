# @open-pencil/feedback

The Cloudflare Worker behind `feedback.openpencil.dev`. It is operated by the OpenPencil team for official builds and is not meant to be self-hosted; forks and self-built apps never call it.

| Route | What it does | What it keeps |
| --- | --- | --- |
| `POST /ping` | The daily anonymous ping. | One counter per day and build (version, OS, architecture, desktop or web, browser family). Nothing per install, no addresses. |
| `POST /ingest` | Opt-in usage stats, forwarded to PostHog EU. Refuses any event or property not in `src/contract`. | Nothing. PostHog gets no client address, person profile, or GeoIP. |
| `GET /admin/` | The team's metrics dashboard, built from the app's `metrics.html` (`bun run build:metrics` writes `dist-metrics/`, which Wrangler uploads as the Worker's assets), behind Cloudflare Access. | Nothing. |
| `GET /admin/api/snapshot?start&end` | The metrics dashboard's data for a range of UTC days, behind Cloudflare Access. | Nothing; it reads pings, snapshots, and the waitlist from D1 (email domains only) and asks PostHog for usage. |
| `POST /waitlist` | OpenPencil Cloud waitlist sign-ups from the website and the web app's Settings, checked by Turnstile and confirmed by email. | The address and optional note; unconfirmed sign-ups are removed after seven days. |

Two daily cron jobs run besides the routes. Just after midnight UTC the metrics snapshot records the day that ended for the team's metrics dashboard: GitHub stars and forks, running download totals per release and kind of file (installers, macOS updates, and `latest.json` update checks), repository views, clones, and referrers, and Cloudflare's visits to `openpencil.dev` and `app.openpencil.dev` with the website's top pages and countries. It also mirrors the repository's issues and pull requests (author association, opening, closing, and merge times), syncing only what changed since the last run, so open counts per day go back to the repository's start. GitHub keeps traffic for 14 days and Cloudflare's Free plan keeps visits for 31, so these tables are the only lasting history; each run also fetches again the last few days Cloudflare may still have been counting, and fills any missing days it still can. At 03:17 UTC, retention deletes unconfirmed waitlist sign-ups.

`@open-pencil/feedback/contract` holds the request schemas and the event list, and `@open-pencil/feedback/client` is a client typed by the Worker's routes (`hc<FeedbackAPI>`). The app sends through that client and the privacy page renders its tables from the contract, so the documented, sent, and accepted data cannot drift apart.

## Development

```sh
cp packages/feedback/.dev.vars.example packages/feedback/.dev.vars
bun --filter @open-pencil/feedback dev       # wrangler dev with a local D1
bun run test:feedback                        # typecheck and tests against a local D1
bun --filter @open-pencil/feedback types     # after changing wrangler.jsonc
bun run build:metrics                        # the dashboard page in dist-metrics/, for deploys
```

The dashboard's components have Storybook stories under `App/Metrics/Dashboard`.

Apply migrations to the local database with `bunx wrangler d1 migrations apply feedback --local` from this folder.

## Production setup

Done once on the Cloudflare account; `.github/workflows/feedback.yml` deploys every change to `master` afterwards.

1. `bunx wrangler d1 create feedback --jurisdiction eu` and put the database ID in `wrangler.jsonc` (done for the production database).
2. Onboard `openpencil.dev` to Email Service so `hello@openpencil.dev` can send. Sending to addresses outside the account needs the Workers Paid plan; send one confirmation to an outside address before announcing the waitlist.
3. Create a Turnstile widget for `openpencil.dev` and `app.openpencil.dev`, the hostnames in `TURNSTILE_HOSTNAMES` (its public site key is `TURNSTILE_SITE_KEY` in the contract; the form gives it the `waitlist` action), then `bunx wrangler secret put TURNSTILE_SECRET`.
4. Create a PostHog EU project with "Discard client IP data" on and data retention at 12 months, as the privacy page promises, then `bunx wrangler secret put POSTHOG_KEY` with its project key.
5. For the metrics snapshot, `bunx wrangler secret put GITHUB_TOKEN` with a fine-grained token for the repository in `GITHUB_REPOSITORY` that has read-only **Administration** access, which the traffic API requires (every token can already read the public repository's releases, issues, and pull requests), and `bunx wrangler secret put CLOUDFLARE_ANALYTICS_TOKEN` with an account API token that has **Zone → Analytics → Read** on the zone in `SITE_ZONE_ID`.
6. For the dashboard's API, create a Cloudflare Access self-hosted application for `feedback.openpencil.dev/admin/*` that allows the team's addresses (add the One-time PIN login method for people without a Cloudflare account), then `bunx wrangler secret put ACCESS_TEAM_DOMAIN` with `https://<team>.cloudflareaccess.com` and `bunx wrangler secret put ACCESS_AUD` with the application's audience tag. Until both are set, `/admin` refuses every request.
7. Create a PostHog personal API key scoped to the project in `POSTHOG_PROJECT_ID` with only **Query: Read**, then `bunx wrangler secret put POSTHOG_PERSONAL_KEY`.
