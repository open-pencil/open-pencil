<script setup lang="ts">
import { useCloudPortalMessages } from '@open-pencil/vue/i18n'

import BrandMark from '@/components/brand/BrandMark.vue'
import PortalFooter from '@/components/cloud-portal/layout/PortalFooter.vue'
import { portalCommunity } from '@/components/cloud-portal/ui'

/** A community gallery page: the server's mark leading to the gallery, the page, and the foot. */
const { host } = defineProps<{ host: string }>()

const ui = portalCommunity()
const messages = useCloudPortalMessages()
</script>

<template>
  <div :class="ui.page()">
    <header :class="ui.header()">
      <RouterLink :to="{ name: 'community' }" class="flex items-center gap-3">
        <BrandMark variant="app-icon" decorative :class="ui.mark()" />
        <span :class="ui.headerTitle()">{{ messages.productName }}</span>
      </RouterLink>
      <a href="/" :class="ui.headerLink()">{{ messages.openEditor }}</a>
    </header>
    <main :class="ui.main()">
      <slot />
    </main>
    <PortalFooter :host="host" />
  </div>
</template>
