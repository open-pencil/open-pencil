<script setup lang="ts">
import { useStatusMessages } from '@open-pencil/vue/i18n'
import { useSceneComputed } from '@open-pencil/vue/internal/scene-computed'

import { useEditorStore } from '@/app/editor/active-store'
import { openStatusesDialog } from '@/app/editor/statuses/dialog'
import StatusDot from '@/components/statuses/StatusDot.vue'
import IconButton from '@/components/ui/button/IconButton.vue'
import PanelSection from '@/components/ui/panel/PanelSection.vue'

/** The document's statuses at a glance, with nothing selected, and the way to edit them. */
const store = useEditorStore()
const messages = useStatusMessages()
const states = useSceneComputed(() => store.statusWorkflow().states)
</script>

<template>
  <PanelSection :label="messages.statuses" data-test-id="statuses-section">
    <template #actions>
      <IconButton :label="messages.editStatuses" @click="openStatusesDialog(store)">
        <icon-lucide-square-arrow-out-up-right class="size-3.5" />
      </IconButton>
    </template>
    <ul class="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted">
      <li v-for="state in states" :key="state.id" class="flex items-center gap-1.5">
        <StatusDot :color="state.color" />
        {{ state.name }}
      </li>
    </ul>
  </PanelSection>
</template>
