<script setup lang="ts">
import { ref } from 'vue'

import WorkspacePill from '../WorkspacePill.vue'

const log = ref<string[]>([])
const record = (entry: string) => {
  log.value = [entry, ...log.value].slice(0, 4)
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <div class="relative h-20 w-[520px] rounded-lg bg-canvas">
      <WorkspacePill
        mode="preview"
        document-name="Settings screen"
        shortcut="⌥⌘↩"
        @reset="record('reset')"
        @leave="record('leave')"
      />
    </div>
    <div class="relative h-20 w-[520px] rounded-lg bg-canvas">
      <WorkspacePill
        mode="collapsed"
        document-name="Settings screen"
        shortcut="⌘\"
        @show-ui="record('show UI')"
      />
    </div>
    <ul class="text-xs text-muted" aria-label="Events">
      <li v-for="entry in log" :key="entry">{{ entry }}</li>
    </ul>
  </div>
</template>
