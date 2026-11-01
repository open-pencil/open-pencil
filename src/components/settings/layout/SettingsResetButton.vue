<script setup lang="ts">
import { useSettingsMessages } from '@open-pencil/vue/i18n'

import IconButton from '@/components/ui/button/IconButton.vue'

/**
 * Puts one setting back to its default. A row shows it only while its value differs from the
 * default, as VS Code's settings do, so an unchanged page shows none.
 */
const emit = defineEmits<{ reset: [] }>()
const settings = useSettingsMessages()
</script>

<template>
  <IconButton
    :label="settings.resetToDefault"
    size="sm"
    data-settings-reset
    @click.prevent="emit('reset')"
  >
    <icon-lucide-rotate-ccw class="size-3.5" />
  </IconButton>
</template>
