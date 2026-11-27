<script setup lang="ts">
import { createColumnHelper, tableFeatures, useTable } from '@tanstack/vue-table'
import { computed, h } from 'vue'

import type { CampaignPlacement } from '@open-pencil/feedback/contract'

import { formatCount, formatShare } from '@/app/metrics/format'
import AppDataTable from '@/components/ui/table/AppDataTable.vue'

import type { CampaignCount } from './types'

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

type CampaignRow = CampaignCount & { id: string; rate: number }

const rows = computed<CampaignRow[]>(() =>
  campaigns.map((row) => ({
    ...row,
    id: `${row.campaign} ${row.placement}`,
    rate: row.shown ? row.acted / row.shown : 0
  }))
)

const features = tableFeatures({ columnMeta: {} })
const column = createColumnHelper<typeof features, CampaignRow>()
const NUMBER = { class: 'w-18 text-end tabular-nums' }
const count = (key: 'shown' | 'dismissed' | 'acted', header: string) =>
  column.accessor(key, { header, cell: (cell) => formatCount(cell.getValue()), meta: NUMBER })
const columns = column.columns([
  column.accessor('campaign', {
    header: 'Campaign',
    cell: ({ row }) =>
      h('span', [
        h('span', { class: 'font-medium' }, row.original.campaign),
        h('span', { class: 'ms-1.5 text-muted' }, PLACEMENTS[row.original.placement])
      ]),
    meta: { class: 'truncate' }
  }),
  count('shown', 'Shown'),
  count('dismissed', 'Not now'),
  count('acted', 'Followed'),
  column.accessor('rate', {
    header: 'Rate',
    cell: (cell) => formatShare(cell.getValue()),
    meta: NUMBER
  })
])
const table = useTable({ features, columns, data: rows, getRowId: (row: CampaignRow) => row.id })
</script>

<template>
  <AppDataTable :table="table" label="Campaigns" />
</template>
