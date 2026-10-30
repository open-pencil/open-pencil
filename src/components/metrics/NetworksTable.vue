<script setup lang="ts">
import { tv } from 'tailwind-variants'
import { computed } from 'vue'

import { formatCount, formatShare } from '@/app/metrics/format'
import { metricsNetworksTheme } from '@/theme/metrics/dashboard'

import type { PingNetwork } from './types'

const metricsNetworks = tv(metricsNetworksTheme)

/**
 * The busiest networks by pings, with each one's share of every network's pings; one cloud
 * network far ahead of the rest usually means automated installs rather than people.
 */
const {
  networks,
  total,
  limit = 5
} = defineProps<{
  networks: PingNetwork[]
  /** Every network's pings, so a share counts the ones the table leaves out. */
  total: number
  limit?: number
}>()
const ui = metricsNetworks()

const rows = computed(() =>
  networks.slice(0, limit).map((network) => {
    const pings = network.desktop + network.web
    return {
      asn: network.asn,
      name: network.asn && network.name ? network.name : 'Not reported',
      pings,
      share: total ? pings / total : 0
    }
  })
)
</script>

<template>
  <table :class="ui.table()">
    <thead>
      <tr :class="ui.row()">
        <th :class="ui.asn()" scope="col">AS</th>
        <th :class="ui.name()" scope="col">Network</th>
        <th :class="ui.number()" scope="col">Share</th>
        <th :class="ui.number()" scope="col">Pings</th>
      </tr>
    </thead>
    <tbody>
      <tr v-for="row in rows" :key="row.asn" :class="ui.row()">
        <td :class="ui.asn()">{{ row.asn || '—' }}</td>
        <td :class="ui.name()">{{ row.name }}</td>
        <td :class="ui.number()">{{ formatShare(row.share) }}</td>
        <td :class="ui.number()">{{ formatCount(row.pings) }}</td>
      </tr>
    </tbody>
  </table>
</template>
