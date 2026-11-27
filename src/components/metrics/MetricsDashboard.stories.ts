import { parseDate } from '@internationalized/date'
import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { sumBy } from 'es-toolkit'
import { computed, ref } from 'vue'

import type { MetricsSnapshot } from '@open-pencil/feedback/contract'

import { presetRange } from '@/app/metrics/range'
import type { MetricsRange } from '@/app/metrics/range'

import MetricsDashboard from './MetricsDashboard.vue'

// The week after v0.16.0 shipped, as the feedback Worker answers for it. Daily pings, visits,
// website pages and countries, GitHub traffic and referrers, usage, and retention are real; step
// counts, contributors, Cloud, and daily star and download growth are illustrative.
const TODAY = '2026-10-19'
const EARLIEST = '2026-09-22'

// Every ping the week had, from 0.16.0, which sends no step.
const pinged = [19, 376, 913, 840, 639, 699, 587]
// Illustrative: a release that counts its days ships on Oct 16, so upgrading installs start over as
// new, and a saved state restored over and over replays its second day.
const stepped = [
  { new: 0, returning: 0, replayed: 0 },
  { new: 0, returning: 0, replayed: 0 },
  { new: 0, returning: 0, replayed: 0 },
  { new: 212, returning: 0, replayed: 0 },
  { new: 141, returning: 118, replayed: 240 },
  { new: 96, returning: 187, replayed: 310 },
  { new: 74, returning: 203, replayed: 250 }
]
const DAYS = [
  '2026-10-13',
  '2026-10-14',
  '2026-10-15',
  '2026-10-16',
  '2026-10-17',
  '2026-10-18',
  '2026-10-19'
]
const installs = DAYS.map((day, index) => {
  const steps = stepped[index] ?? { new: 0, returning: 0, replayed: 0 }
  const all = pinged[index] ?? 0
  return {
    day,
    ...steps,
    unchecked: Math.max(0, all - steps.new - steps.returning - steps.replayed)
  }
})
// The checked installs split about three to two between desktop and web.
const dailyActive = installs.map((day) => {
  const checked = day.new + day.returning
  const desktop = Math.round(checked * 0.6)
  return { day: day.day, desktop, web: checked - desktop }
})
const visits = [
  { day: '2026-10-13', site: 2342, app: 1107, cloud: 0 },
  { day: '2026-10-14', site: 3884, app: 729, cloud: 0 },
  { day: '2026-10-15', site: 4810, app: 970, cloud: 0 },
  { day: '2026-10-16', site: 3356, app: 1030, cloud: 0 },
  { day: '2026-10-17', site: 2283, app: 1093, cloud: 0 },
  { day: '2026-10-18', site: 2829, app: 1282, cloud: 0 },
  { day: '2026-10-19', site: 1765, app: 830, cloud: 0 }
]
// Checked pings on the release that counts its days, and everything before it.
const versions = installs.map((day) => ({
  day: day.day,
  latest: day.new + day.returning + day.replayed,
  other: 0,
  unchecked: day.unchecked
}))
const growth = (added: number[]) =>
  added.map((value, index) => ({ day: DAYS[index] ?? TODAY, added: value }))
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
// Illustrative: a steady trickle of first merges onto a team of a dozen.
const contributors = DAYS.slice(0, -1).map((day, index) => ({
  day,
  team: 12,
  community: 81 + index * 2 + (index > 2 ? 1 : 0),
  newTeam: 0,
  newCommunity: [0, 2, 2, 3, 2, 2][index] ?? 0
}))
// Illustrative: Cloud's first public week.
const cloudDays = DAYS.slice(0, -1).map((day, index) => ({
  day,
  signUps: [14, 22, 19, 11, 9, 16][index] ?? 0,
  activeAccounts: [31, 48, 57, 52, 44, 61][index] ?? 0,
  documentsCreated: [20, 35, 28, 19, 15, 30][index] ?? 0,
  revisions: [88, 140, 162, 131, 97, 175][index] ?? 0
}))
// Answers to sharing usage stats, shaped like the real split: few agree, about half never answer.
const sharing = installs.map((day) => {
  const checked = day.new + day.returning + day.replayed
  const granted = Math.round(checked * 0.06)
  const denied = Math.round(checked * 0.45)
  return { day: day.day, granted, denied, unset: checked - granted - denied }
})
const npmDaily = DAYS.slice(0, -1).map((day, index) => ({
  day,
  downloads: [7120, 8919, 6245, 6967, 5310, 4870][index] ?? 0
}))
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
 * `withActivity` false is the issue mirror before its first sync, and `withCloud` false is
 * before the first snapshot of Cloud's counts.
 */
function scope(
  range: MetricsRange,
  withUsage: boolean,
  withActivity: boolean,
  withCloud: boolean
): MetricsSnapshot {
  const inRange = <T extends { day: string }>(rows: T[]) =>
    rows.filter((row) => isInRange(row.day, range))
  return {
    asOf: '2026-10-19T11:36:00Z',
    today: TODAY,
    earliest: EARLIEST,
    start: range.start,
    end: range.end,
    dailyActive: inRange(dailyActive),
    installs: inRange(installs),
    sharing: inRange(sharing),
    platforms: [
      { os: 'macos', desktop: 428, web: 356 },
      { os: 'windows', desktop: 386, web: 327 },
      { os: 'linux', desktop: 83, web: 105 },
      { os: 'android', desktop: 0, web: 43 },
      { os: 'ios', desktop: 0, web: 28 }
    ],
    // Networks are illustrative, shaped like a cloud network's automated installs.
    networks: {
      total: 2512,
      top: [
        { asn: 136907, name: 'Huawei Cloud Singapore Region', desktop: 2089, web: 0 },
        { asn: 7922, name: 'Comcast Cable Communications, LLC', desktop: 101, web: 88 },
        { asn: 4134, name: 'Chinanet', desktop: 54, web: 61 },
        { asn: 3320, name: 'Deutsche Telekom AG', desktop: 40, web: 33 },
        { asn: 9299, name: 'Philippine Long Distance Telephone Company', desktop: 12, web: 9 },
        { asn: 0, name: '', desktop: 3, web: 1 }
      ]
    },
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
      referrers: {
        day: '2026-10-18',
        top: [
          { name: 'Google', value: 1722 },
          { name: 'github.com', value: 847 },
          { name: 'openpencil.dev', value: 467 },
          { name: 'Bing', value: 124 },
          { name: 'youtube.com', value: 80 }
        ]
      },
      activity: withActivity
        ? { issues: inRange(issues), pulls: inRange(pulls), contributors: inRange(contributors) }
        : { issues: [], pulls: [], contributors: [] }
    },
    cloud: withCloud
      ? {
          days: inRange(cloudDays),
          totals: {
            day: '2026-10-18',
            accounts: 214,
            documents: 380,
            workspaces: 231,
            storageBytes: 1_843_000_000
          }
        }
      : null,
    npm: {
      daily: inRange(npmDaily),
      packages: [
        { name: '@open-pencil/core', value: 21_840 },
        { name: '@open-pencil/scene-graph', value: 9_120 },
        { name: '@open-pencil/fig', value: 4_515 },
        { name: '@open-pencil/vue', value: 2_960 },
        { name: '@open-pencil/mcp', value: 1_230 },
        { name: '@open-pencil/cli', value: 941 }
      ]
    },
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
          ],
          campaigns: [
            { campaign: 'donation', placement: 'prompt', shown: 24, dismissed: 16, acted: 2 },
            { campaign: 'cloud-trial', placement: 'share', shown: 11, dismissed: 3, acted: 4 }
          ],
          donations: [
            { source: 'settings', clicks: 4 },
            { source: 'menu', clicks: 3 },
            { source: 'prompt', clicks: 1 }
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

const story = (frame: string, withUsage = true, withActivity = true, withCloud = true): Story => ({
  render: () => ({
    components: { MetricsDashboard },
    setup: () => {
      const range = ref(presetRange('7d', TODAY, EARLIEST))
      const snapshot = computed(() => scope(range.value, withUsage, withActivity, withCloud))
      return { range, snapshot }
    },
    template: `<div class="${frame}"><MetricsDashboard host="feedback.openpencil.dev" :snapshot="snapshot" v-model:range="range" /></div>`
  })
})

export const Overview = story('h-987.5')

/** PostHog did not answer: retention and usage give way to a notice, the rest stays. */
export const WithoutUsage = story('h-887.5', false)

/** Before the first nightly sync, issues and pull requests give way to a notice. */
export const BeforeIssueSync = story('h-850', true, false)

/** Before the first snapshot of Cloud's counts, its card gives way to a notice. */
export const BeforeCloudSnapshot = story('h-987.5', true, true, false)

/** The dashboard in a phone-width window. */
export const Narrow = story('h-1612.5 w-97.5')
