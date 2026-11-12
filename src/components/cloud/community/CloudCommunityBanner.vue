<script setup lang="ts">
import { computed } from 'vue'

import { useCloudMessages } from '@open-pencil/vue/i18n'

import { cloudCommunityTabs } from '@/app/cloud/community/link'
import { activeTab } from '@/app/tabs'
import AppBanner from '@/components/ui/feedback/AppBanner.vue'

/** Says the tab in front is a community gallery example, open read-only, while it is shown. */
const t = useCloudMessages()
const show = computed(() => {
  const store = activeTab.value?.store
  return store !== undefined && cloudCommunityTabs.value.has(store)
})
</script>

<template>
  <AppBanner v-if="show">
    <span class="inline-flex items-center gap-1.5">
      <icon-lucide-eye class="size-3.5 shrink-0" />
      {{ t.communityBanner }}
    </span>
  </AppBanner>
</template>
