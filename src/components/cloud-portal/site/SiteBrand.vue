<script setup lang="ts">
import { useSiteIdentity } from '@/app/cloud-portal/identity'
import BrandMark from '@/components/brand/BrandMark.vue'

import { siteBrand } from './ui'

/** The site's name with OpenPencil's mark, or with a self-hosted operator's own logo. */
const site = useSiteIdentity()
const ui = siteBrand()
</script>

<template>
  <span :class="ui.root()">
    <img v-if="site.logoURL" :src="site.logoURL" alt="" :class="ui.logo()" />
    <BrandMark v-else variant="mark" decorative :class="ui.mark()" />
    <span :class="ui.name()">{{ site.name }}</span>
  </span>
</template>
