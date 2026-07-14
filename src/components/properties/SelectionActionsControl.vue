<script setup lang="ts">
import { useEditorCommands } from '@open-pencil/vue'

import BooleanOperationsControl from '@/components/properties/BooleanOperationsControl.vue'
import IconButton from '@/components/ui/IconButton.vue'

const { showBooleanOperations = false } = defineProps<{
  showBooleanOperations?: boolean
}>()

const { getCommand, runCommand } = useEditorCommands()
const maskCommand = getCommand('selection.toggleMask')
</script>

<template>
  <div class="ml-auto flex items-center gap-1">
    <IconButton
      :label="maskCommand.label"
      :disabled="!maskCommand.enabled.value"
      data-test-id="selection-toggle-mask"
      @click="runCommand('selection.toggleMask')"
    >
      <icon-lucide-shapes class="size-3.5" />
    </IconButton>
    <BooleanOperationsControl v-if="showBooleanOperations" />
  </div>
</template>
