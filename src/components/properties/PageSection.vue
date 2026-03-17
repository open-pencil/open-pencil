<script setup lang="ts">
import ColorInput from '@/components/ColorInput.vue'
import { PageControlsRoot } from '@open-pencil/vue'
</script>

<template>
  <PageControlsRoot v-slot="{ pageColor, setPageColor }">
    <div data-test-id="page-section" class="border-b border-border px-3 py-2">
      <label class="mb-1.5 block text-[11px] text-muted">Page</label>
      <ColorInput :color="pageColor" editable @update="setPageColor" />
    </div>
  </PageControlsRoot>
</template>
