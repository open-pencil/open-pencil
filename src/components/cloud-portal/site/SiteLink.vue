<script setup lang="ts">
import { siteLink } from './ui'

/**
 * A link in the site's bar or footer: a page of this server through the router, or an address
 * elsewhere, which opens in a new tab.
 */
const {
  href,
  external = false,
  place = 'footer',
  current = false
} = defineProps<{
  href: string
  external?: boolean
  place?: 'nav' | 'footer'
  current?: boolean
}>()

const ui = siteLink({ place })
</script>

<template>
  <a
    v-if="external || !href.startsWith('/')"
    :href="href"
    target="_blank"
    rel="noreferrer"
    :class="ui"
  >
    <slot />
  </a>
  <RouterLink v-else :to="href" :class="ui" :aria-current="current ? 'page' : undefined">
    <slot />
  </RouterLink>
</template>
