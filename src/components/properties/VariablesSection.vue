<script setup lang="ts">
import Tip from '@/components/Tip.vue'
import { VariablesIndicatorRoot } from '@open-pencil/vue'

const emit = defineEmits<{ openDialog: [] }>()
</script>

<template>
  <VariablesIndicatorRoot v-slot="{ variableCount, collectionCount, hasVariables }">
    <div data-test-id="variables-section" class="border-b border-border px-3 py-2">
      <div class="flex items-center justify-between">
        <label class="text-[11px] font-medium text-surface">Variables</label>
        <Tip label="Open variables">
          <button
            data-test-id="variables-section-open"
            class="flex size-5 cursor-pointer items-center justify-center rounded border-none bg-transparent text-muted hover:bg-hover hover:text-surface"
            @click="emit('openDialog')"
          >
            <icon-lucide-settings-2 class="size-3.5" />
          </button>
        </Tip>
      </div>
      <div v-if="hasVariables" class="mt-1 text-[11px] text-muted">
        {{ variableCount }} variable{{ variableCount !== 1 ? 's' : '' }} in
        {{ collectionCount }} collection{{ collectionCount !== 1 ? 's' : '' }}
      </div>
      <div v-else class="mt-1 text-[11px] text-muted">No local variables</div>
    </div>
  </VariablesIndicatorRoot>
</template>
