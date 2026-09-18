<script setup lang="ts">
import type { ToolAccessEntry, ToolAccessGroup } from '@/app/automation/tool-access/types'
import SettingsDisclosure from '@/components/settings/layout/SettingsDisclosure.vue'
import AppSwitch from '@/components/ui/toggle/AppSwitch.vue'

const { groups, expanded, isEnabled } = defineProps<{
  groups: ToolAccessGroup[]
  expanded: Record<ToolAccessEntry['effect'], boolean>
  isEnabled: (tool: ToolAccessEntry) => boolean
}>()

const emit = defineEmits<{
  'update:expanded': [effect: ToolAccessEntry['effect'], open: boolean]
  'set-group': [effect: ToolAccessEntry['effect'], enabled: boolean]
  'set-tool': [name: string, enabled: boolean]
}>()
</script>

<template>
  <div data-slot="tool-access-list">
    <template v-for="group in groups" :key="group.effect">
      <SettingsDisclosure
        v-if="group.tools.length"
        :open="expanded[group.effect]"
        class="border-b border-border"
        @update:open="emit('update:expanded', group.effect, $event)"
      >
        <template #label>{{ group.label }}</template>
        <template #actions>
          <AppSwitch
            :model-value="group.enabled"
            :state="group.state"
            :label="group.label"
            @update:model-value="emit('set-group', group.effect, $event)"
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
              @update:model-value="emit('set-tool', tool.name, $event)"
            />
          </li>
        </ul>
      </SettingsDisclosure>
    </template>
  </div>
</template>
