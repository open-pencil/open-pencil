<script setup lang="ts">
import { MIXED } from '@open-pencil/vue/controls/node-props'
import { useSelectionLayout } from '@open-pencil/vue/controls/selection-layout'
import { useI18n } from '@open-pencil/vue/i18n'

const layout = useSelectionLayout()
const { panels } = useI18n()
</script>

<template>
  <label class="mt-2 flex cursor-pointer items-center gap-2 text-xs text-surface">
    <input
      type="checkbox"
      data-test-id="clip-content-checkbox"
      class="accent-accent"
      :checked="layout.clipsContent.value === true"
      :indeterminate="layout.clipsContent.value === MIXED"
      @change="layout.toggleClipsContent()"
    />
    {{ panels.clipContent }}
  </label>
</template>
