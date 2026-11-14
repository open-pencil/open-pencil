<script setup lang="ts">
import { useHead } from '@unhead/vue'

import BrandMark from '@/components/brand/BrandMark.vue'
import { portalPublic } from '@/components/cloud-portal/ui'

import PortalFooter from './PortalFooter.vue'

/**
 * A Cloud page for people who are signing in or answering a request, laid out as the app's
 * startup notice: the app icon, or the page's own icon, then a title and one narrow column whose
 * buttons sit right under what they act on.
 */
const { host, heading, description, title } = defineProps<{
  host: string
  heading: string
  description?: string
  /** The tab's name, when the heading already names the site, as "Sign in to …" does. */
  title?: string
}>()

// The page's heading names its tab, under the site's name (`CloudPortalApp`).
useHead({ title: () => title ?? heading })

const ui = portalPublic()
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
            <p v-if="description || $slots.description" :class="ui.description()">
              <slot name="description">{{ description }}</slot>
            </p>
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
    <PortalFooter :host="host" />
  </div>
</template>
