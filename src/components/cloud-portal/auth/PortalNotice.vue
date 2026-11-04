<script setup lang="ts">
import { portalPublic } from '@/components/cloud-portal/ui'

import PortalPublicLayout from '../layout/PortalPublicLayout.vue'

/**
 * A Cloud page that tells the person where they stand and what to do next: an icon, one
 * sentence, and at most a primary and a secondary button stacked below.
 */
const {
  host,
  heading,
  description,
  tone = 'neutral'
} = defineProps<{
  host: string
  heading: string
  description: string
  tone?: 'neutral' | 'success' | 'waiting'
}>()

const ui = portalPublic()
</script>

<template>
  <PortalPublicLayout :host="host" :heading="heading" :description="description">
    <template #icon>
      <span :class="ui.tile({ tone })" aria-hidden="true"><slot name="icon" /></span>
    </template>
    <template v-if="$slots.default || $slots.actions" #default>
      <slot />
      <div v-if="$slots.actions" :class="ui.actions()">
        <slot name="actions" />
      </div>
    </template>
  </PortalPublicLayout>
</template>
