<script setup lang="ts">
import AccountAvatar from '@/components/presence/AccountAvatar.vue'
import { portalList } from '@/theme/cloud-portal/list'

import type { PortalActivityEntry } from '../types'

/** What administrators did on the server, newest first. */
const { entries } = defineProps<{ entries: PortalActivityEntry[] }>()
const ui = portalList()
</script>

<template>
  <ul :class="ui.list()">
    <li v-for="entry in entries" :key="entry.id" :class="ui.row()">
      <AccountAvatar :id="entry.actor.id" :name="entry.actor.name" />
      <p :class="[ui.body(), 'text-xs text-muted']">
        <span class="font-medium text-surface">{{ entry.actor.name }}</span>
        {{ entry.action }}
        <span class="text-surface">{{ entry.target }}</span>
      </p>
      <span :class="ui.meta()">{{ entry.when }}</span>
    </li>
  </ul>
</template>
