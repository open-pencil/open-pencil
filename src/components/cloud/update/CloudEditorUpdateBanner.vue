<script setup lang="ts">
import { computed } from 'vue'

import { useCloudMessages, useUpdateMessages } from '@open-pencil/vue/i18n'

import {
  cloudServerNeedingUpdate,
  editorUpdateRoute,
  updateEditor
} from '@/app/cloud/sessions/update'
import AppBanner from '@/components/ui/feedback/AppBanner.vue'

/**
 * Says a saved server needs a newer editor than this one, and offers the update: the desktop
 * updater, or a reload in the browser. A package whose store delivers updates only says so.
 */
const cloud = useCloudMessages()
const updates = useUpdateMessages()
const host = computed(() =>
  cloudServerNeedingUpdate.value ? new URL(cloudServerNeedingUpdate.value.url).host : null
)
const route = editorUpdateRoute()

function update() {
  void updateEditor(updates)
}
</script>

<template>
  <AppBanner v-if="host" @action="update">
    {{ cloud.editorOutdatedBanner({ host }) }}
    <template v-if="route === 'updater'" #action>{{ cloud.updateOpenPencil }}</template>
    <template v-else-if="route === 'reload'" #action>{{ updates.reload }}</template>
  </AppBanner>
</template>
