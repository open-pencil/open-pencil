<script setup lang="ts">
import { computed } from 'vue'

import { openExternalLink } from '@/app/shell/ui'

import { campaignLinkTarget } from './markdown'

/**
 * A link in a campaign's body. Only openpencil.dev over HTTPS stays a link, opened in the
 * browser as other external links are; any other address shows as its text.
 */
const { href } = defineProps<{ href?: string }>()

const target = computed(() => campaignLinkTarget(href))

function open() {
  if (target.value) void openExternalLink(target.value)
}
</script>

<template>
  <a
    v-if="target"
    :href="target"
    target="_blank"
    rel="noopener noreferrer"
    data-markdown="link"
    @click.prevent="open"
    ><slot
  /></a>
  <span v-else><slot /></span>
</template>
