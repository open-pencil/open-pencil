<script setup lang="ts">
import { computed } from 'vue'

import { useCloudMessages } from '@open-pencil/vue/i18n'

import { cloudCommunityTabs } from '@/app/cloud/community/link'
import { openSaveTo } from '@/app/storage/save-to/session'
import { activeTab } from '@/app/tabs'
import AppBanner from '@/components/ui/feedback/AppBanner.vue'

/**
 * Says the tab in front is a community gallery example, open read-only, while it is shown, and
 * offers Save to for a copy the visitor can edit, signing in first when there is nowhere to save
 * yet. The tab becomes that copy (`cloudCommunityTabs`).
 */
const t = useCloudMessages()
const store = computed(() => {
  const shown = activeTab.value?.store
  return shown && cloudCommunityTabs.value.has(shown) ? shown : null
})
</script>

<template>
  <AppBanner v-if="store" @action="openSaveTo(store, { exceptPublic: true })">
    <span class="inline-flex items-center gap-1.5">
      <icon-lucide-eye class="size-3.5 shrink-0" />
      {{ t.communityBanner }}
    </span>
    <template #action>{{ t.communitySaveCopy }}</template>
  </AppBanner>
</template>
