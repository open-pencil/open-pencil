import { parseDate } from '@internationalized/date'
import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { sumBy } from 'es-toolkit'
import { computed, ref } from 'vue'

import type { MetricsSnapshot } from '@open-pencil/feedback/contract'

import { utcDayOfTimestamp } from '@/app/metrics/days'
import { presetRange } from '@/app/metrics/range'
import type { MetricsRange } from '@/app/metrics/range'

import MetricsDashboard from './MetricsDashboard.vue'

// The week after v0.16.0 shipped, as the feedback Worker answers for it. Pings, versions, visits,
// website pages and countries, GitHub traffic and referrers, usage, retention, and waitlist
// sign-ups are real; daily star and download growth before the snapshot job are illustrative.
const TODAY = '2026-10-19'
const EARLIEST = '2026-09-22'

const dailyActive = [
  { day: '2026-10-13', desktop: 19, web: 0 },
  { day: '2026-10-14', desktop: 193, web: 183 },
  { day: '2026-10-15', desktop: 432, web: 481 },
  { day: '2026-10-16', desktop: 443, web: 397 },
  { day: '2026-10-17', desktop: 390, web: 249 },
  { day: '2026-10-18', desktop: 401, web: 298 },
  { day: '2026-10-19', desktop: 330, web: 257 }
]
const visits = [
  { day: '2026-10-13', site: 2342, app: 1107 },
  { day: '2026-10-14', site: 3884, app: 729 },
  { day: '2026-10-15', site: 4810, app: 970 },
  { day: '2026-10-16', site: 3356, app: 1030 },
  { day: '2026-10-17', site: 2283, app: 1093 },
  { day: '2026-10-18', site: 2829, app: 1282 },
  { day: '2026-10-19', site: 1765, app: 830 }
]
const versions = [
  { day: '2026-10-13', latest: 0, other: 19 },
  { day: '2026-10-14', latest: 354, other: 22 },
  { day: '2026-10-15', latest: 905, other: 8 },
  { day: '2026-10-16', latest: 838, other: 2 },
  { day: '2026-10-17', latest: 637, other: 2 },
  { day: '2026-10-18', latest: 697, other: 2 },
  { day: '2026-10-19', latest: 586, other: 1 }
]
const growth = (added: number[]) =>
  added.map((value, index) => ({ day: dailyActive[index]?.day ?? TODAY, added: value }))
const traffic = [
  { day: '2026-10-13', views: 420, uniqueViews: 230, clones: 2900 },
  { day: '2026-10-14', views: 980, uniqueViews: 610, clones: 7400 },
  { day: '2026-10-15', views: 760, uniqueViews: 402, clones: 6800 },
  { day: '2026-10-16', views: 515, uniqueViews: 277, clones: 6170 },
  { day: '2026-10-17', views: 601, uniqueViews: 299, clones: 3884 },
  { day: '2026-10-18', views: 477, uniqueViews: 283, clones: 3807 }
]
const issues = [
  {
    day: '2026-10-13',
    openTeam: 23,
    openCommunity: 42,
    openedTeam: 7,
    openedCommunity: 7,
    closedTeam: 0,
    closedCommunity: 1
  },
  {
    day: '2026-10-14',
    openTeam: 23,
    openCommunity: 44,
    openedTeam: 0,
    openedCommunity: 2,
    closedTeam: 0,
    closedCommunity: 0
  },
  {
    day: '2026-10-15',
    openTeam: 23,
    openCommunity: 44,
    openedTeam: 0,
    openedCommunity: 2,
    closedTeam: 0,
    closedCommunity: 2
  },
  {
    day: '2026-10-16',
    openTeam: 23,
    openCommunity: 46,
    openedTeam: 0,
    openedCommunity: 2,
    closedTeam: 0,
    closedCommunity: 0
  },
  {
    day: '2026-10-17',
    openTeam: 24,
    openCommunity: 49,
    openedTeam: 1,
    openedCommunity: 3,
    closedTeam: 0,
    closedCommunity: 0
  },
  {
    day: '2026-10-18',
    openTeam: 25,
    openCommunity: 50,
    openedTeam: 1,
    openedCommunity: 2,
    closedTeam: 0,
    closedCommunity: 1
  }
]
const pulls = [
  {
    day: '2026-10-13',
    openTeam: 15,
    openCommunity: 37,
    openedTeam: 20,
    openedCommunity: 42,
    closedTeam: 21,
    closedCommunity: 6,
    mergedTeam: 21,
    mergedCommunity: 6
  },
  {
    day: '2026-10-14',
    openTeam: 17,
    openCommunity: 43,
    openedTeam: 8,
    openedCommunity: 6,
    closedTeam: 6,
    closedCommunity: 0,
    mergedTeam: 6,
    mergedCommunity: 0
  },
  {
    day: '2026-10-15',
    openTeam: 17,
    openCommunity: 53,
    openedTeam: 14,
    openedCommunity: 13,
    closedTeam: 14,
    closedCommunity: 3,
    mergedTeam: 13,
    mergedCommunity: 2
  },
  {
    day: '2026-10-16',
    openTeam: 17,
    openCommunity: 56,
    openedTeam: 5,
    openedCommunity: 4,
    closedTeam: 5,
    closedCommunity: 1,
    mergedTeam: 4,
    mergedCommunity: 1
  },
  {
    day: '2026-10-17',
    openTeam: 15,
    openCommunity: 60,
    openedTeam: 1,
    openedCommunity: 12,
    closedTeam: 3,
    closedCommunity: 8,
    mergedTeam: 2,
    mergedCommunity: 0
  },
  {
    day: '2026-10-18',
    openTeam: 17,
    openCommunity: 59,
    openedTeam: 6,
    openedCommunity: 1,
    closedTeam: 4,
    closedCommunity: 2,
    mergedTeam: 4,
    mergedCommunity: 1
  }
]
const signups = [
  { domain: 'crugroup.com', signedUpAt: '2026-10-14T16:12:31Z', confirmed: true },
  { domain: 'gmail.com', signedUpAt: '2026-10-14T22:11:38Z', confirmed: true },
  { domain: 'cpiprint.com', signedUpAt: '2026-10-15T03:06:45Z', confirmed: true },
  { domain: 'allganize.io', signedUpAt: '2026-10-15T08:50:54Z', confirmed: true },
  { domain: 'protonmail.com', signedUpAt: '2026-10-15T19:13:20Z', confirmed: false },
  { domain: 'gmail.com', signedUpAt: '2026-10-16T15:56:03Z', confirmed: true },
  { domain: 'creatonium.agency', signedUpAt: '2026-10-17T08:35:45Z', confirmed: true },
  { domain: 'veltrum.cl', signedUpAt: '2026-10-18T15:39:22Z', confirmed: false },
  { domain: 'gmail.com', signedUpAt: '2026-10-18T20:33:57Z', confirmed: true },
  { domain: 'szscc.cn', signedUpAt: '2026-10-19T04:07:57Z', confirmed: true },
  { domain: 'gmail.com', signedUpAt: '2026-10-19T07:46:12Z', confirmed: false },
  { domain: 'exient.com', signedUpAt: '2026-10-19T11:02:58Z', confirmed: true }
]
const usageDaily = [
  { day: '2026-10-13', installs: 2 },
  { day: '2026-10-14', installs: 30 },
  { day: '2026-10-15', installs: 68 },
  { day: '2026-10-16', installs: 56 },
  { day: '2026-10-17', installs: 43 },
  { day: '2026-10-18', installs: 45 },
  { day: '2026-10-19', installs: 53 }
]
const retention = [
  { cohort: '2026-10-14', values: [28, 9, 7, 3, 2, 3] },
  { cohort: '2026-10-15', values: [59, 14, 4, 0, 7] },
  { cohort: '2026-10-16', values: [35, 6, 6, 4] },
  { cohort: '2026-10-17', values: [30, 7] },
  { cohort: '2026-10-18', values: [30, 8] },
  { cohort: '2026-10-19', values: [31] }
]

/** Whether a day falls within the range, both ends included. */
const isInRange = (day: string, range: MetricsRange) =>
  parseDate(day).compare(parseDate(range.start)) >= 0 &&
  parseDate(day).compare(parseDate(range.end)) <= 0

/**
 * What the feedback Worker answers for a range; `withUsage` false is PostHog not answering,
 * `withActivity` false is the issue mirror before its first sync.
 */
function scope(range: MetricsRange, withUsage: boolean, withActivity: boolean): MetricsSnapshot {
  const inRange = <T extends { day: string }>(rows: T[]) =>
    rows.filter((row) => isInRange(row.day, range))
  const recent = signups.filter((signup) =>
    isInRange(utcDayOfTimestamp(signup.signedUpAt).toString(), range)
  )
  return {
    asOf: '2026-10-19T11:36:00Z',
    today: TODAY,
    earliest: EARLIEST,
    start: range.start,
    end: range.end,
    dailyActive: inRange(dailyActive),
    platforms: [
      { os: 'macos', desktop: 428, web: 356 },
      { os: 'windows', desktop: 386, web: 327 },
      { os: 'linux', desktop: 83, web: 105 },
      { os: 'android', desktop: 0, web: 43 },
      { os: 'ios', desktop: 0, web: 28 }
    ],
    versions: { latest: '0.16.0', daily: inRange(versions) },
    releases: inRange([{ day: '2026-10-14', version: '0.16.0' }]),
    visits: inRange(visits),
    website: {
      pages: [
        { name: '/', value: 9181 },
        { name: '/programmable/mcp-server', value: 786 },
        { name: '/getting-started', value: 564 },
        { name: '/download', value: 488 },
        { name: '/development/roadmap', value: 422 },
        { name: '/es/', value: 358 }
      ],
      countries: [
        { name: 'US', value: 8212 },
        { name: 'CN', value: 1831 },
        { name: 'SG', value: 1672 },
        { name: 'FR', value: 1330 },
        { name: 'DE', value: 955 },
        { name: 'IN', value: 779 }
      ]
    },
    github: {
      stars: { total: 9120, daily: inRange(growth([18, 30, 33, 31, 25, 27, 9])) },
      downloads: {
        total: 36662,
        latestTag: 'v0.16.0',
        latestTotal: 2028,
        daily: inRange(growth([0, 620, 419, 308, 307, 374, 0])),
        updateChecks: inRange(growth([0, 1110, 931, 1100, 980, 1050, 0]))
      },
      traffic: inRange(traffic),
      referrers: [
        { name: 'Google', value: 1722 },
        { name: 'github.com', value: 847 },
        { name: 'openpencil.dev', value: 467 },
        { name: 'Bing', value: 124 },
        { name: 'youtube.com', value: 80 }
      ],
      activity: withActivity
        ? { issues: inRange(issues), pulls: inRange(pulls) }
        : { issues: [], pulls: [] }
    },
    waitlist: { total: 22, confirmed: 16, added: recent.length, recent: recent.toReversed() },
    usage: withUsage
      ? {
          installs: sumBy(inRange(usageDaily), (day) => day.installs),
          daily: inRange(usageDaily),
          retention: retention.filter((cohort) => isInRange(cohort.cohort, range)),
          documents: [
            { name: 'fig', value: 496 },
            { name: 'pen', value: 19 },
            { name: 'html', value: 5 }
          ],
          exports: [
            { name: 'png', value: 14 },
            { name: 'pptx', value: 1 }
          ],
          aiProviders: [
            { name: 'openai-compatible', value: 85 },
            { name: 'openrouter', value: 22 },
            { name: 'deepseek', value: 6 },
            { name: 'openai', value: 5 },
            { name: 'anthropic-compatible', value: 3 },
            { name: 'google', value: 1 },
            { name: 'anthropic', value: 1 }
          ]
        }
      : null
  }
}

const meta = {
  title: 'App/Metrics/Dashboard',
  parameters: { layout: 'fullscreen' }
} satisfies Meta

export default meta
type Story = StoryObj<typeof meta>

const story = (frame: string, withUsage = true, withActivity = true): Story => ({
  render: () => ({
    components: { MetricsDashboard },
    setup: () => {
      const range = ref(presetRange('7d', TODAY, EARLIEST))
      const snapshot = computed(() => scope(range.value, withUsage, withActivity))
      return { range, snapshot }
    },
    template: `<div class="${frame}"><MetricsDashboard host="feedback.openpencil.dev" :snapshot="snapshot" v-model:range="range" /></div>`
  })
})

export const Overview = story('h-[3950px]')

/** PostHog did not answer: retention and usage give way to a notice, the rest stays. */
export const WithoutUsage = story('h-[3550px]', false)

/** Before the first nightly sync, issues and pull requests give way to a notice. */
export const BeforeIssueSync = story('h-[3000px]', true, false)

/** The dashboard in a phone-width window. */
export const Narrow = story('h-[6100px] w-[390px]')
