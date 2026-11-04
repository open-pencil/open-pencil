<script setup lang="ts">
import { useCloudPortalMessages } from '@open-pencil/vue/i18n'

import SettingsGroup from '@/components/settings/layout/SettingsGroup.vue'
import AppSkeleton from '@/components/ui/feedback/AppSkeleton.vue'
import { skeleton } from '@/components/ui/feedback/skeleton'

/**
 * A settings page before it loads, in its own shape: the person it is about when `avatar` is on,
 * then one group per entry of `groups` with that many rows, so the page fills in without moving.
 */
const { avatar = false, groups } = defineProps<{ avatar?: boolean; groups: readonly number[] }>()
const placeholders = skeleton()
const messages = useCloudPortalMessages()
</script>

<template>
  <!-- The bars are for the eye; the status says it to assistive technology. -->
  <span role="status" class="sr-only">{{ messages.loading }}</span>
  <div :class="[placeholders.group(), 'flex max-w-2xl flex-col gap-6']" aria-hidden="true">
    <div v-if="avatar" class="flex items-center gap-3">
      <AppSkeleton class="size-12 rounded-full" />
      <div class="flex flex-col gap-2">
        <AppSkeleton class="h-3 w-32" />
        <AppSkeleton class="w-44" />
      </div>
    </div>
    <div v-for="(rows, group) in groups" :key="group" class="flex flex-col gap-3">
      <AppSkeleton class="w-24" />
      <SettingsGroup>
        <div
          v-for="row in rows"
          :key="row"
          class="flex items-center justify-between gap-4 px-3 py-3"
        >
          <div class="flex flex-col gap-2">
            <AppSkeleton class="w-20" />
            <AppSkeleton class="w-40" />
          </div>
          <AppSkeleton class="h-7 w-24 rounded-md" />
        </div>
      </SettingsGroup>
    </div>
  </div>
</template>
