<script setup lang="ts">
import { computed } from 'vue'

import { acpActions, acpConnecting, acpState } from '@/app/ai/agents/acp/catalog'
import type { ACPControl } from '@/app/ai/agents/acp/catalog'
import { toast } from '@/app/shell/ui'
import AppSelect from '@/components/ui/select/AppSelect.vue'

import { chatProfileTheme } from './ui'

const ui = chatProfileTheme()

// Model first, then reasoning, then mode and the rest.
const ORDER = { model: 0, thought_level: 1, mode: 2, other: 3 } as const
const controls = computed(() =>
  [...(acpState.value?.controls ?? [])]
    .filter((c) => c.options.length > 1)
    .sort((a, b) => ORDER[a.category] - ORDER[b.category])
)

function labelOf(control: ACPControl): string {
  return control.options.find((o) => o.value === control.current)?.label ?? control.current
}

async function change(control: ACPControl, value: string) {
  if (value === control.current) return
  try {
    await acpActions.value?.setControl(control, value)
  } catch (e) {
    toast.error(e instanceof Error ? e.message : String(e))
  }
}
</script>

<template>
  <div class="flex min-w-0 flex-1 items-center overflow-hidden">
    <span v-if="acpConnecting && !controls.length" class="px-1.5 text-[10px] text-muted">...</span>
    <AppSelect
      v-for="control in controls"
      :key="control.kind + control.id"
      :model-value="control.current"
      :label="`${control.name}: ${labelOf(control)}`"
      :options="control.options.map((o) => ({ value: o.value, label: o.label }))"
      :data-test-id="`acp-control-${control.category}`"
      @update:model-value="(v: string) => change(control, v)"
    >
      <template #trigger>
        <button
          type="button"
          :class="ui.trigger({ class: 'inline-flex max-w-28 items-center' })"
          :aria-label="control.name"
        >
          <span class="min-w-0 truncate">{{ labelOf(control) }}</span>
          <icon-lucide-chevron-down :class="ui.triggerChevron()" aria-hidden="true" />
        </button>
      </template>
    </AppSelect>
  </div>
</template>
