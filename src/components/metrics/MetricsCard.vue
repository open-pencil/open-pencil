<script setup lang="ts">
import { tv } from 'tailwind-variants'

import { metricsCardTheme } from '@/theme/metrics/dashboard'

const metricsCard = tv(metricsCardTheme)

const { heading, note } = defineProps<{ heading: string; note?: string }>()
const ui = metricsCard()
</script>

<template>
  <section :class="ui.root()" :aria-label="heading">
    <header :class="ui.header()">
      <div :class="ui.titleGroup()">
        <h3 :class="ui.title()">{{ heading }}</h3>
        <p v-if="note" :class="ui.note()">{{ note }}</p>
      </div>
      <div v-if="$slots.aside" :class="ui.aside()"><slot name="aside" /></div>
    </header>
    <slot />
  </section>
</template>
