<script setup lang="ts">
import { useI18n } from '@open-pencil/vue'

const { online } = defineProps<{ online: boolean }>()
const { dialogs } = useI18n()
</script>

<template>
  <footer
    class="flex h-5 shrink-0 items-center justify-center gap-1.5 border-t border-border bg-panel px-2 text-[10px] text-muted"
    data-test-id="cloud-workspace-status"
  >
    <span
      class="size-1.5 rounded-full"
      :class="online ? 'bg-green-500' : 'bg-amber-500'"
      aria-hidden="true"
    />
    <span>{{ online ? dialogs.cloudWorkspaceConnected : dialogs.cloudWorkspaceOffline }}</span>
  </footer>
</template>
