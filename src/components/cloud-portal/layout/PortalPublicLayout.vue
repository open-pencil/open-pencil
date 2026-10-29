<script setup lang="ts">
import { useCloudPortalMessages } from '@open-pencil/vue/i18n'

import BrandMark from '@/components/brand/BrandMark.vue'
import { portalPublic } from '@/components/cloud-portal/ui'
import { CLOUD_DOCS_URL } from '@/constants'

/**
 * A Cloud page for people who are signing in or answering a request, laid out as the app's
 * startup notice: the app icon, or the page's own icon, then a title and one narrow column whose
 * buttons sit right under what they act on.
 */
const { host, heading, description } = defineProps<{
  host: string
  heading: string
  description?: string
}>()

const ui = portalPublic()
const messages = useCloudPortalMessages()
</script>

<template>
  <div :class="ui.page()">
    <main :class="ui.main()">
      <section :class="ui.column()" aria-labelledby="portal-heading">
        <header :class="ui.header()">
          <slot name="icon">
            <BrandMark variant="app-icon" decorative :class="ui.icon()" />
          </slot>
          <div :class="ui.headingGroup()">
            <h1 id="portal-heading" :class="ui.title()">{{ heading }}</h1>
            <p v-if="description" :class="ui.description()">{{ description }}</p>
          </div>
        </header>
        <div v-if="$slots.default" :class="ui.body()">
          <slot />
        </div>
        <p v-if="$slots.aside" :class="ui.aside()">
          <slot name="aside" />
        </p>
      </section>
    </main>
    <footer :class="ui.footer()">
      <span>{{ host }}</span>
      <a :href="CLOUD_DOCS_URL" target="_blank" rel="noreferrer" :class="ui.footerLink()">
        {{ messages.help }}
      </a>
    </footer>
  </div>
</template>
