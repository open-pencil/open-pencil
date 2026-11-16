<script setup lang="ts">
import { useSiteIdentity } from '@/app/cloud-portal/identity'

import SiteFooterColumns from './SiteFooterColumns.vue'
import SiteFooterCompact from './SiteFooterCompact.vue'

/** The foot of the site's pages: OpenPencil's on the official server, the operator's elsewhere. */
const site = useSiteIdentity()
</script>

<template>
  <SiteFooterColumns v-if="site.official" />
  <SiteFooterCompact v-else />
</template>
