<script setup lang="ts">
import { useSelectionState } from '@open-pencil/vue/editor/selection-state'

import ActionBuilderSection from './event-builder/components/ActionBuilderSection.vue'
import BlockPropertiesSection from './event-builder/components/BlockPropertiesSection.vue'
import ConnectionSection from './event-builder/components/ConnectionSection.vue'
import EmptySelectionState from './event-builder/components/EmptySelectionState.vue'
import SyncSection from './event-builder/components/SyncSection.vue'

const { selectedNode: node } = useSelectionState()
</script>

<template>
  <div
    data-test-id="event-builder-panel"
    class="flex min-w-0 flex-1 flex-col overflow-y-auto select-text text-xs"
  >
    <ConnectionSection />
    <SyncSection />

    <template v-if="node">
      <BlockPropertiesSection :node="node" />
      <ActionBuilderSection :node="node" />
    </template>
    <EmptySelectionState v-else />
  </div>
</template>
