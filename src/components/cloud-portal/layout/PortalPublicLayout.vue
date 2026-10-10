<script setup lang="ts">
import { useCloudPortalMessages } from '@open-pencil/vue'

import BrandMark from '@/components/brand/BrandMark.vue'
import { portalLayout } from '@/theme/cloud-portal/layout'

/** A Cloud page for people who are signing in or answering a request, around one card. */
const { host, heading, description } = defineProps<{
  host: string
  heading: string
  description?: string
}>()

const ui = portalLayout()
const messages = useCloudPortalMessages()
</script>

<template>
  <div :class="ui.page()">
    <header :class="ui.bar()">
      <BrandMark variant="micro" decorative />
      <span :class="ui.barTitle()">{{ messages.productName }}</span>
      <span :class="ui.barHost()">{{ host }}</span>
    </header>
    <main :class="ui.center()">
      <section :class="ui.card()" :aria-label="heading">
        <slot name="icon" />
        <div :class="ui.cardHeader()">
          <h1 :class="ui.cardTitle()">{{ heading }}</h1>
          <p v-if="description" :class="ui.cardDescription()">{{ description }}</p>
        </div>
        <slot />
        <footer v-if="$slots.footer" :class="ui.cardFooter()">
          <slot name="footer" />
        </footer>
      </section>
    </main>
  </div>
</template>
