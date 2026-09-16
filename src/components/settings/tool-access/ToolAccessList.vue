<script setup lang="ts">
import { toRef } from 'vue'

import { useAutomationMessages, useCommonMessages } from '@open-pencil/vue'

import { useToolAccess } from '@/app/automation/tool-access/settings/list'
import type { ToolAccessEntry } from '@/app/automation/tool-access/types'
import SettingsDisclosure from '@/components/settings/layout/SettingsDisclosure.vue'
import AppButton from '@/components/ui/button/AppButton.vue'
import AppPlaceholder from '@/components/ui/feedback/AppPlaceholder.vue'
import AppInput from '@/components/ui/input/AppInput.vue'
import AppSwitch from '@/components/ui/toggle/AppSwitch.vue'

const { tools } = defineProps<{ tools: ToolAccessEntry[] }>()
const emit = defineEmits<{ reset: [] }>()
const disabledTools = defineModel<string[]>('disabledTools', { required: true })
const {
  search,
  visibleTools,
  enabledCount,
  groups,
  expanded,
  setGroupEnabled,
  isEnabled,
  setToolEnabled
} = useToolAccess(
  toRef(() => tools),
  disabledTools
)
const automation = useAutomationMessages()
const common = useCommonMessages()
</script>

<template>
  <div class="flex min-h-0 flex-1 flex-col overflow-hidden" data-slot="tool-access">
    <div class="flex shrink-0 items-center justify-between gap-3 border-b border-border p-3">
      <div class="min-w-0 flex-1">
        <h3 class="text-xs font-semibold text-surface">{{ automation.tools }}</h3>
        <p class="mt-1 text-xs text-muted">
          {{ automation.toolsEnabled({ enabled: enabledCount, total: tools.length }) }}
        </p>
      </div>
      <AppButton size="xs" variant="link" @click="emit('reset')">{{
        automation.restoreToolDefaults
      }}</AppButton>
    </div>
    <div class="shrink-0 border-b border-border p-3">
      <AppInput
        v-model="search"
        type="search"
        :placeholder="common.search"
        :aria-label="automation.searchTools"
      />
    </div>
    <div class="min-h-0 flex-1 overflow-y-auto overscroll-contain" data-slot="tool-list">
      <AppPlaceholder v-if="!visibleTools.length" :label="automation.noMatchingTools" fill />
      <template v-for="group in groups" :key="group.effect">
        <SettingsDisclosure
          v-if="group.tools.length"
          :open="expanded[group.effect]"
          class="border-b border-border px-3"
          @update:open="expanded[group.effect] = $event"
        >
          <template #label>{{
            group.effect === 'read' ? automation.readOnlyTools : automation.sideEffectTools
          }}</template>
          <template #actions>
            <AppSwitch
              :model-value="group.enabled"
              :state="group.state"
              :label="
                group.effect === 'read' ? automation.readOnlyTools : automation.sideEffectTools
              "
              @update:model-value="setGroupEnabled(group.effect, $event)"
            />
          </template>
          <ul class="divide-y divide-border">
            <li v-for="tool in group.tools" :key="tool.name" class="flex items-start gap-3 py-3">
              <div class="min-w-0 flex-1">
                <code class="break-all text-xs font-medium text-surface">{{ tool.name }}</code>
                <p class="mt-1 text-xs leading-relaxed text-muted">{{ tool.description }}</p>
              </div>
              <AppSwitch
                :model-value="isEnabled(tool)"
                :label="tool.name"
                @update:model-value="setToolEnabled(tool.name, $event)"
              />
            </li>
          </ul>
        </SettingsDisclosure>
      </template>
    </div>
    <p
      v-if="$slots.footer"
      class="shrink-0 border-t border-border p-3 text-xs leading-relaxed text-muted"
    >
      <slot name="footer" />
    </p>
  </div>
</template>
