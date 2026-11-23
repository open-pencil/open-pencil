<script setup lang="ts">
import { computed } from 'vue'

import { useMessages } from '@open-pencil/vue/i18n'

import { canReport, startCloudReport } from '@/app/cloud/reports/file'
import { useEditorStore } from '@/app/editor/active-store'
import IconButton from '@/components/ui/button/IconButton.vue'

/** Beside the name of a document opened from a share link: report it to its server. */
const store = useEditorStore()
const t = useMessages('cloud/editor')
const shown = computed(() => canReport(store))
</script>

<template>
  <IconButton v-if="shown" :label="t.reportFile" @click="startCloudReport(store)">
    <icon-lucide-flag class="size-3.5" />
  </IconButton>
</template>
