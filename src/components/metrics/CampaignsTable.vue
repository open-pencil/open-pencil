<script setup lang="ts">
import { tv } from 'tailwind-variants'
import { computed } from 'vue'

import type { CampaignPlacement } from '@open-pencil/feedback/contract'

import { formatCount, formatShare } from '@/app/metrics/format'
import { metricsCampaignsTheme } from '@/theme/metrics/dashboard'

import type { CampaignCount } from './types'

const metricsCampaigns = tv(metricsCampaignsTheme)

const PLACEMENTS: Record<CampaignPlacement, string> = {
  prompt: 'corner prompt',
  'settings-cloud': 'Settings › Cloud',
  'settings-models': 'Settings › Models',
  'settings-integrations': 'Settings › Integrations',
  'settings-usage': 'Settings › Usage',
  share: 'share dialog'
}

/**
 * Each campaign where it showed: how often, how often it was put off, and how often its button
 * was followed, with that as a share of the times it showed.
 */
const { campaigns } = defineProps<{ campaigns: CampaignCount[] }>()
const ui = metricsCampaigns()

const rows = computed(() =>
  campaigns.map((row) => ({
    ...row,
    key: `${row.campaign} ${row.placement}`,
    where: PLACEMENTS[row.placement],
    rate: row.shown ? row.acted / row.shown : 0
  }))
)
</script>

<template>
  <table :class="ui.table()">
    <thead>
      <tr :class="ui.row()">
        <th :class="ui.name()" scope="col">Campaign</th>
        <th :class="ui.number()" scope="col">Shown</th>
        <th :class="ui.number()" scope="col">Not now</th>
        <th :class="ui.number()" scope="col">Followed</th>
        <th :class="ui.number()" scope="col">Rate</th>
      </tr>
    </thead>
    <tbody>
      <tr v-for="row in rows" :key="row.key" :class="ui.row()">
        <td :class="ui.name()">
          <span :class="ui.campaign()">{{ row.campaign }}</span>
          <span :class="ui.placement()">{{ row.where }}</span>
        </td>
        <td :class="ui.number()">{{ formatCount(row.shown) }}</td>
        <td :class="ui.number()">{{ formatCount(row.dismissed) }}</td>
        <td :class="ui.number()">{{ formatCount(row.acted) }}</td>
        <td :class="ui.number()">{{ formatShare(row.rate) }}</td>
      </tr>
    </tbody>
  </table>
</template>
