<script setup lang="ts">
import { computed } from 'vue'

import { colorToCSS } from '@open-pencil/scene-graph/color'

import type { PagePresenceEntry } from '@/app/presence/registry'
import Tip from '@/components/ui/overlay/Tip.vue'
import { pageMarkers } from '@/theme/collaboration/page-markers'

/** How many people and agents a row shows before summarizing the rest as "+N". */
const MAX_MARKERS = 3

const { entries } = defineProps<{ entries: PagePresenceEntry[] }>()

const ui = pageMarkers()
const shown = computed(() => entries.slice(0, MAX_MARKERS))
const hidden = computed(() => entries.length - shown.value.length)
const names = computed(() => entries.map((entry) => entry.name).join(', '))
</script>

<template>
  <Tip v-if="entries.length > 0" :label="names">
    <span data-test-id="presence-markers" :aria-label="names" role="img" :class="ui.root()">
      <template v-for="entry in shown" :key="entry.id">
        <icon-lucide-sparkle
          v-if="entry.kind === 'agent'"
          :class="ui.agent()"
          :style="{ color: colorToCSS(entry.color) }"
        />
        <span v-else :class="ui.person()" :style="{ background: colorToCSS(entry.color) }" />
      </template>
      <span v-if="hidden > 0" :class="ui.overflow()">+{{ hidden }}</span>
    </span>
  </Tip>
</template>
