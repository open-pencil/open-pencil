<script setup lang="ts">
import { maxBy, meanBy, sumBy } from 'es-toolkit'
import { tv } from 'tailwind-variants'
import { BarList } from 'vccs'
import { computed } from 'vue'

import type { MetricsSnapshot } from '@open-pencil/feedback/contract'

import {
  formatBytes,
  formatCount,
  formatCountry,
  formatDay,
  formatPercent,
  formatShare,
  formatTime
} from '@/app/metrics/format'
import { rangePhrase } from '@/app/metrics/range'
import type { MetricsRange } from '@/app/metrics/range'
import BrandMark from '@/components/brand/BrandMark.vue'
import IconButton from '@/components/ui/button/IconButton.vue'
import AppPlaceholder from '@/components/ui/feedback/AppPlaceholder.vue'
import SegmentedControl from '@/components/ui/select/SegmentedControl.vue'
import { metricsDashboardTheme } from '@/theme/metrics/dashboard'

import DailyChart from './DailyChart.vue'
import type { DailySeries } from './DailyChart.vue'
import DailyLevelChart from './DailyLevelChart.vue'
import MetricsCard from './MetricsCard.vue'
import MetricsRangePicker from './MetricsRangePicker.vue'
import MetricsTile from './MetricsTile.vue'
import NetworksTable from './NetworksTable.vue'
import PlatformsChart from './PlatformsChart.vue'
import RetentionChart from './RetentionChart.vue'
import type {
  DailyActiveDay,
  DailyCloud,
  DailyContributors,
  DailyInstalls,
  DailyPulls,
  DailyTraffic,
  DailyVersions,
  DailyVisits
} from './types'

const metricsDashboard = tv(metricsDashboardTheme)

/**
 * Day-to-day numbers in one place: anonymous daily pings and Cloudflare visits for reach,
 * PostHog for what the installs that share stats do, GitHub and Cloud for growth, and the
 * repository's activity. The range scopes everything below it; `snapshot` already holds only
 * those days.
 */
const {
  host,
  snapshot,
  loading = false,
  openReports
} = defineProps<{
  host: string
  snapshot: MetricsSnapshot
  /** Newer numbers are on their way; the current ones stay, dimmed. */
  loading?: boolean
  /** How many reports in the range are open, once the inbox has loaded. */
  openReports?: number
}>()
const range = defineModel<MetricsRange>('range', { required: true })
/** The numbers, or the report inbox, which the `reports` slot holds. */
const tab = defineModel<'metrics' | 'reports'>('tab', { default: 'metrics' })
const emit = defineEmits<{ refresh: [] }>()
defineSlots<{
  /** A notice above the numbers, such as a failed refresh. */
  alert?(): unknown
  /** The report inbox, shown on its tab. */
  reports?(): unknown
}>()

const tabs = computed(() => [
  { value: 'metrics', label: 'Metrics' },
  { value: 'reports', label: openReports ? `Reports (${formatCount(openReports)})` : 'Reports' }
])
const tabValue = computed({
  get: () => tab.value,
  set: (value: string) => {
    if (value === 'metrics' || value === 'reports') tab.value = value
  }
})

const ui = metricsDashboard()
const phrase = computed(() => rangePhrase(range.value))
const usage = computed(() => snapshot.usage)

// Today is still being counted, so headline numbers and tile trends use full days only.
const isFull = (row: { day: string }) => row.day !== snapshot.today
const checked = (day: DailyInstalls) => day.new + day.returning + day.replayed
// Every full day from the first with pings that carry a step, quiet ones included.
const checkedDays = computed(() => {
  const first = snapshot.installs.findIndex((day) => checked(day) > 0)
  return first === -1 ? [] : snapshot.installs.slice(first).filter(isFull)
})
const fullDays = computed(() => snapshot.installs.filter(isFull))
// The headline is the installs the steps can vouch for: a restored copy of a saved state can't
// raise it past what earlier steps supplied, and versions without steps can't be told from one.
const active = computed(() => {
  const days = checkedDays.value
  if (days.length) {
    const installs = (day: DailyInstalls) => day.new + day.returning
    const peakDay = maxBy(days, installs)
    return {
      value: Math.round(meanBy(days, installs)),
      label: 'Daily active installs, average',
      detail: `${formatCount(Math.round(meanBy(days, (day) => day.returning)))} returning · ${formatCount(
        Math.round(meanBy(days, (day) => day.new))
      )} new a day${peakDay ? ` · peak ${formatCount(installs(peakDay))} on ${formatDay(peakDay.day)}` : ''}`,
      trend: days.map(installs)
    }
  }
  const all = fullDays.value
  return {
    value: all.length ? Math.round(meanBy(all, (day) => day.unchecked)) : 0,
    label: 'Daily pings, average',
    detail: 'no version in this range counts its days',
    trend: all.length ? all.map((day) => day.unchecked) : undefined
  }
})
type Growth = MetricsSnapshot['github']['stars']['daily']
// Growth needs two recorded days; until then the tile says so rather than showing a zero.
const added = (daily: Growth) => (daily.length ? sumBy(daily, (day) => day.added) : undefined)
const growthDetail = (daily: Growth) => (daily.length ? phrase.value : 'no daily history yet')
const fullTrend = (daily: Growth) => daily.filter(isFull).map((day) => day.added)
const cloud = computed(() => snapshot.cloud)
const signUps = computed(() =>
  cloud.value?.days.length ? sumBy(cloud.value.days, (day) => day.signUps) : undefined
)

// What the steps can't vouch for recedes: replayed pings and pings from versions without steps.
const UNCHECKED_COLOR = 'color-mix(in oklab, var(--color-muted) 40%, transparent)'
const STEP_SERIES: DailySeries<Exclude<keyof DailyInstalls, 'day'>>[] = [
  { key: 'returning', name: 'Returning', color: 'var(--color-chart-1)' },
  { key: 'new', name: 'New', color: 'var(--color-chart-3)' },
  { key: 'replayed', name: 'Replayed', color: 'var(--color-muted)' },
  { key: 'unchecked', name: 'Unchecked', color: UNCHECKED_COLOR }
]
const INSTALL_SERIES: DailySeries<keyof DailyActiveDay & string>[] = [
  { key: 'desktop', name: 'Desktop', color: 'var(--color-chart-1)' },
  { key: 'web', name: 'Web', color: 'var(--color-chart-2)' }
]
// The web app keeps the web installs' color at either address; the site takes the next one.
const VISIT_SERIES: DailySeries<keyof DailyVisits & string>[] = [
  { key: 'site', name: 'openpencil.dev', color: 'var(--color-chart-3)' },
  { key: 'cloud', name: 'cloud.openpencil.dev', color: 'var(--color-chart-1)' },
  { key: 'app', name: 'app.openpencil.dev', color: 'var(--color-chart-2)' }
]
const CLOUD_ACCOUNT_SERIES: DailySeries<'activeAccounts' | 'signUps'>[] = [
  { key: 'activeAccounts', name: 'Active accounts', color: 'var(--color-chart-1)' },
  { key: 'signUps', name: 'Sign-ups', color: 'var(--color-chart-3)' }
]
const CLOUD_DOCUMENT_SERIES: DailySeries<keyof DailyCloud & ('documentsCreated' | 'revisions')>[] =
  [
    { key: 'revisions', name: 'Saves', color: 'var(--color-chart-1)' },
    { key: 'documentsCreated', name: 'Documents created', color: 'var(--color-chart-3)' }
  ]
const CONTRIBUTOR_SERIES: DailySeries<'community' | 'team'>[] = [
  { key: 'community', name: 'Community', color: 'var(--color-chart-1)' },
  { key: 'team', name: 'Team', color: 'var(--color-chart-3)' }
]
const NEW_CONTRIBUTOR_SERIES: DailySeries<
  keyof DailyContributors & ('newCommunity' | 'newTeam')
>[] = [
  { key: 'newCommunity', name: 'Community', color: 'var(--color-chart-1)' },
  { key: 'newTeam', name: 'Team', color: 'var(--color-chart-3)' }
]
const TRAFFIC_SERIES: DailySeries<keyof DailyTraffic & string>[] = [
  { key: 'views', name: 'Views', color: 'var(--color-chart-1)' },
  { key: 'uniqueViews', name: 'Unique visitors', color: 'var(--color-chart-3)' }
]
// The community leads: outside work is what the team answers to.
const OPEN_SERIES: DailySeries<'openCommunity' | 'openTeam'>[] = [
  { key: 'openCommunity', name: 'Community', color: 'var(--color-chart-1)' },
  { key: 'openTeam', name: 'Team', color: 'var(--color-chart-3)' }
]
const OPENED_SERIES: DailySeries<'openedCommunity' | 'openedTeam'>[] = [
  { key: 'openedCommunity', name: 'Community', color: 'var(--color-chart-1)' },
  { key: 'openedTeam', name: 'Team', color: 'var(--color-chart-3)' }
]
const CLOSED_SERIES: DailySeries<'closedCommunity' | 'closedTeam'>[] = [
  { key: 'closedCommunity', name: 'Community', color: 'var(--color-chart-1)' },
  { key: 'closedTeam', name: 'Team', color: 'var(--color-chart-3)' }
]
const MERGED_SERIES: DailySeries<keyof DailyPulls & string>[] = [
  { key: 'mergedCommunity', name: 'Community', color: 'var(--color-chart-1)' },
  { key: 'mergedTeam', name: 'Team', color: 'var(--color-chart-3)' }
]
const activity = computed(() => snapshot.github.activity)
/** How many are open at the end of the last finished day, and how many of them are the community's. */
function openNow(days: { openTeam: number; openCommunity: number }[]) {
  const last = days.at(-1)
  return last
    ? `${formatCount(last.openTeam + last.openCommunity)} open · ${formatCount(last.openCommunity)} from the community`
    : undefined
}

/** How many have contributed by the last finished day, and how many of them are the community. */
const contributorsNow = computed(() => {
  const last = activity.value.contributors.at(-1)
  return last
    ? `${formatCount(last.team + last.community)} in all · ${formatCount(last.community)} from the community`
    : undefined
})

// Older versions recede: the question is how much of the day is already on the latest.
const versionSeries = computed<DailySeries<keyof DailyVersions & string>[]>(() => [
  { key: 'latest', name: snapshot.versions.latest ?? 'Latest', color: 'var(--color-chart-1)' },
  { key: 'other', name: 'Other versions', color: 'var(--color-muted)' },
  { key: 'unchecked', name: 'Without steps', color: UNCHECKED_COLOR }
])
const latestShare = computed(() => {
  // Every ping counts toward the whole, unchecked ones too: they are installs not yet updated.
  const day = snapshot.versions.daily.findLast(isFull)
  const all = day ? day.latest + day.other + day.unchecked : 0
  return day && all ? day.latest / all : undefined
})

// Pings and visits count different things, so this is a rough share, over full days only.
const fullDaySet = computed(() => new Set(fullDays.value.map((day) => day.day)))
const uncheckedShare = computed(() => {
  const all = sumBy(fullDays.value, (day) => checked(day) + day.unchecked)
  return all ? sumBy(fullDays.value, (day) => day.unchecked) / all : undefined
})
const reachedEditor = computed(() => {
  const visits = sumBy(
    snapshot.visits.filter((day) => fullDaySet.value.has(day.day)),
    (day) => day.app + day.cloud
  )
  const web = sumBy(
    snapshot.dailyActive.filter((day) => fullDaySet.value.has(day.day)),
    (day) => day.web
  )
  return visits ? web / visits : undefined
})
const countries = computed(() =>
  snapshot.website.countries.map((country) => ({ ...country, name: formatCountry(country.name) }))
)
// How much of the daily pings PostHog sees, so its numbers are read as the share they are.
const sharingNote = computed(() => {
  if (!usage.value) return undefined
  const shared = sumBy(
    usage.value.daily.filter((day) => fullDaySet.value.has(day.day)),
    (day) => day.installs
  )
  const pinged = sumBy(fullDays.value, (day) => day.new + day.returning)
  const share = pinged ? `, about ${formatPercent(shared / pinged)} of daily active installs` : ''
  return `${formatCount(usage.value.installs)} installs sharing stats${share}`
})
</script>

<template>
  <div :class="ui.page()">
    <header :class="ui.bar()">
      <BrandMark variant="micro" decorative />
      <SegmentedControl v-model="tabValue" :options="tabs" label="Dashboard" />
      <span :class="ui.barHost()">{{ host }}</span>
      <div :class="ui.barEnd()">
        <!-- The inbox spans everything PostHog keeps, so the range belongs to the numbers alone. -->
        <template v-if="tab === 'metrics'">
          <span :class="ui.barMeta()">Updated {{ formatTime(snapshot.asOf) }}</span>
          <MetricsRangePicker
            v-model="range"
            :today="snapshot.today"
            :earliest="snapshot.earliest ?? snapshot.start"
          />
        </template>
        <IconButton label="Refresh" :disabled="loading" @click="emit('refresh')">
          <icon-lucide-refresh-cw class="size-3.5" />
        </IconButton>
      </div>
    </header>
    <main :class="ui.main()">
      <div v-if="tab === 'reports'" :class="ui.inner()">
        <slot name="reports" />
      </div>
      <div v-else :class="ui.inner()" :data-loading="loading" :aria-busy="loading">
        <slot name="alert" />
        <div :class="ui.tiles()">
          <MetricsTile
            :label="active.label"
            :value="active.value"
            :detail="active.detail"
            :trend="active.trend"
          />
          <MetricsTile
            label="Installer downloads"
            :value="snapshot.github.downloads.total"
            :change="added(snapshot.github.downloads.daily)"
            :detail="growthDetail(snapshot.github.downloads.daily)"
            :trend="fullTrend(snapshot.github.downloads.daily)"
          />
          <MetricsTile
            label="GitHub stars"
            :value="snapshot.github.stars.total"
            :change="added(snapshot.github.stars.daily)"
            :detail="growthDetail(snapshot.github.stars.daily)"
            :trend="fullTrend(snapshot.github.stars.daily)"
          />
          <MetricsTile
            label="Cloud accounts"
            :value="cloud?.totals?.accounts ?? null"
            :change="signUps"
            :detail="
              cloud
                ? `${phrase} · as of ${cloud.totals ? formatDay(cloud.totals.day) : 'the first snapshot'}`
                : 'not recorded yet'
            "
            :trend="cloud?.days.map((day) => day.signUps)"
          />
        </div>

        <section :class="ui.section()" aria-labelledby="metrics-reach">
          <h2 id="metrics-reach" :class="ui.sectionHeading()">Reach</h2>
          <MetricsCard
            heading="Daily active installs"
            note="Anonymous pings, one per install per UTC day. Each install moves through its days with a ping one step at a time: 1, 2, 3–4, 5–8, and so on. A step can't hold more installs than reached the step before, so pings beyond that replay a saved state. Versions before 0.17.0 send no step, so nothing can tell their installs from replays: they are unchecked. Days can't be added up: a returning install counts on each day."
          >
            <template v-if="uncheckedShare" #aside>
              {{ formatShare(uncheckedShare) }} of pings unchecked
            </template>
            <DailyChart
              label="Returning, new, replayed, and unchecked installs"
              :days="snapshot.installs"
              :series="STEP_SERIES"
              :today="snapshot.today"
              :releases="snapshot.releases"
              stacked
            />
            <h4 :class="ui.sectionLabel()">Checked installs by app</h4>
            <DailyChart
              label="Returning and new installs, desktop and web"
              :days="snapshot.dailyActive"
              :series="INSTALL_SERIES"
              :today="snapshot.today"
              :height="160"
              stacked
            />
          </MetricsCard>
          <MetricsCard
            heading="Visits"
            note="Cloudflare's count of page views that arrived from another site or a link. Not unique people: a returning visitor counts again."
          >
            <template v-if="reachedEditor !== undefined" #aside>
              About {{ formatPercent(reachedEditor) }} of app visits reach the editor
            </template>
            <DailyChart
              label="Visits to the website and the web app"
              :days="snapshot.visits"
              :series="VISIT_SERIES"
              :today="snapshot.today"
              :releases="snapshot.releases"
            />
          </MetricsCard>
          <div :class="ui.row()">
            <MetricsCard
              heading="Platforms"
              note="Daily pings from versions that send a step, replayed ones included, added up across the range"
            >
              <PlatformsChart :platforms="snapshot.platforms" />
            </MetricsCard>
            <MetricsCard
              heading="Networks"
              note="Every daily ping, checked or not, added up by the network Cloudflare reports"
            >
              <NetworksTable
                v-if="snapshot.networks.top.length"
                :networks="snapshot.networks.top"
                :total="snapshot.networks.total"
              />
              <p v-else :class="ui.sectionLabel()">No networks recorded in this range yet</p>
            </MetricsCard>
          </div>
          <MetricsCard
            heading="Versions"
            note="Daily pings by version. Versions before 0.16.0 send no pings, and versions before 0.17.0 send no step, so their pings are counted apart."
          >
            <template v-if="latestShare !== undefined && snapshot.versions.latest" #aside>
              {{ formatShare(latestShare) }} of pings on {{ snapshot.versions.latest }}
            </template>
            <DailyChart
              label="Daily pings on the latest version and on others"
              :days="snapshot.versions.daily"
              :series="versionSeries"
              :today="snapshot.today"
              :height="200"
              stacked
            />
          </MetricsCard>
          <MetricsCard heading="Website" note="Visits to openpencil.dev by page and country">
            <div :class="ui.breakdown()">
              <div>
                <h4 :class="ui.sectionLabel()">Top pages</h4>
                <BarList
                  class="text-xs"
                  :data="snapshot.website.pages"
                  :value-formatter="formatCount"
                  :row-height="28"
                  :is-animation-active="false"
                />
              </div>
              <div>
                <h4 :class="ui.sectionLabel()">Countries</h4>
                <BarList
                  class="text-xs"
                  :data="countries"
                  :value-formatter="formatCount"
                  :row-height="28"
                  :is-animation-active="false"
                />
              </div>
            </div>
          </MetricsCard>
        </section>

        <section :class="ui.section()" aria-labelledby="metrics-engagement">
          <h2 id="metrics-engagement" :class="ui.sectionHeading()">Engagement</h2>
          <div v-if="usage" :class="ui.row()">
            <MetricsCard
              heading="Retention"
              note="Share of installs that came back N days after their first day; only installs sharing stats"
            >
              <RetentionChart :cohorts="usage.retention" />
            </MetricsCard>
            <MetricsCard heading="What people do" :note="sharingNote">
              <div :class="ui.usage()">
                <div>
                  <h4 :class="ui.sectionLabel()">Documents opened</h4>
                  <BarList
                    class="text-xs"
                    :data="usage.documents"
                    :row-height="28"
                    :is-animation-active="false"
                  />
                </div>
                <div>
                  <h4 :class="ui.sectionLabel()">Exports</h4>
                  <BarList
                    class="text-xs"
                    :data="usage.exports"
                    :row-height="28"
                    :is-animation-active="false"
                  />
                </div>
                <div>
                  <h4 :class="ui.sectionLabel()">AI replies by provider</h4>
                  <BarList
                    class="text-xs"
                    :data="usage.aiProviders"
                    :row-height="28"
                    :is-animation-active="false"
                  />
                </div>
              </div>
            </MetricsCard>
          </div>
          <MetricsCard v-else heading="Usage">
            <AppPlaceholder
              size="compact"
              :fill="false"
              label="PostHog did not answer"
              description="Retention and usage come from PostHog; the rest of the page is current. Refresh to ask again."
            >
              <template #icon><icon-lucide-cloud-off class="size-4" /></template>
            </AppPlaceholder>
          </MetricsCard>
        </section>

        <section :class="ui.section()" aria-labelledby="metrics-growth">
          <h2 id="metrics-growth" :class="ui.sectionHeading()">Growth</h2>
          <div :class="ui.row()">
            <MetricsCard
              heading="GitHub"
              :note="
                snapshot.github.referrers.day
                  ? `Repository views per day, and the sites that sent visitors in the 14 days to ${formatDay(snapshot.github.referrers.day)}`
                  : 'Repository views per day'
              "
            >
              <DailyChart
                label="Repository views and unique visitors"
                :days="snapshot.github.traffic"
                :series="TRAFFIC_SERIES"
                :today="snapshot.today"
                :height="200"
              />
              <BarList
                class="text-xs"
                :data="snapshot.github.referrers.top"
                :value-formatter="formatCount"
                :row-height="28"
                :is-animation-active="false"
              />
            </MetricsCard>
            <MetricsCard
              heading="Cloud"
              note="Counts from OpenPencil Cloud per finished day. Active accounts signed in or saved a revision; editing in a shared room alone is not counted."
            >
              <template v-if="cloud?.totals" #aside>
                {{ formatCount(cloud.totals.documents) }} documents ·
                {{ formatBytes(cloud.totals.storageBytes) }}
              </template>
              <template v-if="cloud">
                <DailyChart
                  label="Cloud's active accounts and sign-ups per day"
                  :days="cloud.days"
                  :series="CLOUD_ACCOUNT_SERIES"
                  :today="snapshot.today"
                  :height="160"
                />
                <h4 :class="ui.sectionLabel()">Documents</h4>
                <DailyChart
                  label="Cloud saves and documents created per day"
                  :days="cloud.days"
                  :series="CLOUD_DOCUMENT_SERIES"
                  :today="snapshot.today"
                  :height="160"
                />
              </template>
              <AppPlaceholder
                v-else
                size="compact"
                :fill="false"
                label="Not recorded yet"
                description="The nightly snapshot at 00:05 UTC reads Cloud's counts, its past days included."
              >
                <template #icon><icon-lucide-cloud class="size-4" /></template>
              </AppPlaceholder>
            </MetricsCard>
          </div>
        </section>

        <section :class="ui.section()" aria-labelledby="metrics-development">
          <h2 id="metrics-development" :class="ui.sectionHeading()">Development</h2>
          <MetricsCard
            v-if="activity.contributors.length"
            heading="Contributors"
            note="People with a merged pull request by the end of each day, and those whose first one merged that day. Bots aside; team: the repository's members and collaborators."
          >
            <template v-if="contributorsNow" #aside>{{ contributorsNow }}</template>
            <DailyLevelChart
              label="Contributors by the community and the team"
              :days="activity.contributors"
              :series="CONTRIBUTOR_SERIES"
            />
            <h4 :class="ui.sectionLabel()">First merged per day</h4>
            <DailyChart
              label="People whose first pull request merged that day"
              :days="activity.contributors"
              :series="NEW_CONTRIBUTOR_SERIES"
              :today="snapshot.today"
              :height="160"
              stacked
            />
          </MetricsCard>
          <div v-if="activity.issues.length" :class="ui.row()">
            <MetricsCard
              heading="Issues"
              note="Open at the end of each day, and opened and closed per day. Team: the repository's members and collaborators."
            >
              <template v-if="openNow(activity.issues)" #aside>{{
                openNow(activity.issues)
              }}</template>
              <h4 :class="ui.sectionLabel()">Open</h4>
              <DailyLevelChart
                label="Open issues by the community and the team"
                :days="activity.issues"
                :series="OPEN_SERIES"
              />
              <h4 :class="ui.sectionLabel()">Opened per day</h4>
              <DailyChart
                label="Issues opened per day by the community and the team"
                :days="activity.issues"
                :series="OPENED_SERIES"
                :today="snapshot.today"
                :height="160"
                stacked
              />
              <h4 :class="ui.sectionLabel()">Closed per day</h4>
              <DailyChart
                label="Issues closed per day, by who opened them"
                :days="activity.issues"
                :series="CLOSED_SERIES"
                :today="snapshot.today"
                :height="160"
                stacked
              />
            </MetricsCard>
            <MetricsCard
              heading="Pull requests"
              note="Open at the end of each day, and opened and merged per day"
            >
              <template v-if="openNow(activity.pulls)" #aside>{{
                openNow(activity.pulls)
              }}</template>
              <h4 :class="ui.sectionLabel()">Open</h4>
              <DailyLevelChart
                label="Open pull requests by the community and the team"
                :days="activity.pulls"
                :series="OPEN_SERIES"
              />
              <h4 :class="ui.sectionLabel()">Opened per day</h4>
              <DailyChart
                label="Pull requests opened per day by the community and the team"
                :days="activity.pulls"
                :series="OPENED_SERIES"
                :today="snapshot.today"
                :height="160"
                stacked
              />
              <h4 :class="ui.sectionLabel()">Merged per day</h4>
              <DailyChart
                label="Pull requests merged per day from the community and the team"
                :days="activity.pulls"
                :series="MERGED_SERIES"
                :today="snapshot.today"
                :height="160"
                stacked
              />
            </MetricsCard>
          </div>
          <MetricsCard v-else heading="Issues and pull requests">
            <AppPlaceholder
              size="compact"
              :fill="false"
              label="Not synced yet"
              description="The nightly snapshot at 00:05 UTC mirrors the repository's issues and pull requests; their whole history shows from then on."
            >
              <template #icon><icon-lucide-git-pull-request class="size-4" /></template>
            </AppPlaceholder>
          </MetricsCard>
        </section>
      </div>
    </main>
  </div>
</template>
