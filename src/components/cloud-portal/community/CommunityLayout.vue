<script setup lang="ts">
import { useTemplateRef, watch } from 'vue'
import { useRoute } from 'vue-router'

import SiteFooter from '@/components/cloud-portal/site/SiteFooter.vue'
import SiteHeader from '@/components/cloud-portal/site/SiteHeader.vue'

/** A community gallery page: the site's bar, the page, and the site's foot. */
const route = useRoute()

// The page scrolls inside its own element, which the router's scroll handling never sees: moving to
// another file starts at the top.
const page = useTemplateRef<HTMLElement>('page')
watch(
  () => route.path,
  () => page.value?.scrollTo({ top: 0 })
)
</script>

<template>
  <div ref="page" class="flex h-full min-h-0 flex-col overflow-y-auto bg-canvas text-surface">
    <SiteHeader />
    <main class="mx-auto flex w-full max-w-6xl flex-1 flex-col px-4 pt-8 pb-16 sm:px-6">
      <slot />
    </main>
    <SiteFooter />
  </div>
</template>
