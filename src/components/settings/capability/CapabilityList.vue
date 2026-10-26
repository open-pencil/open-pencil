<script setup lang="ts">
import SettingsDisclosure from '@/components/settings/layout/SettingsDisclosure.vue'
import IconButton from '@/components/ui/button/IconButton.vue'
import AppSwitch from '@/components/ui/toggle/AppSwitch.vue'

import type { CapabilityGroup, CapabilityItem } from './types'

/**
 * Groups of things the AI can use, each with a switch, as Tool access and Skills list them.
 * Given `openLabel`, an item's name opens its details too.
 */
const { groups, expanded, openLabel } = defineProps<{
  groups: CapabilityGroup[]
  expanded: Record<string, boolean>
  /** The accessible name of an item's details button: `name => "Show brand-review"`. */
  openLabel?: (item: CapabilityItem) => string
}>()

const emit = defineEmits<{
  'update:expanded': [group: string, open: boolean]
  'set-group': [group: string, enabled: boolean]
  'set-item': [group: string, item: string, enabled: boolean]
  open: [group: string, item: string]
}>()

defineSlots<{
  /** Buttons beside a group's switch, such as Trust folder. */
  'group-actions'?: (props: { group: CapabilityGroup }) => unknown
}>()
</script>

<template>
  <div data-slot="capability-list">
    <template v-for="group in groups" :key="group.key">
      <SettingsDisclosure
        v-if="group.items.length || group.empty"
        :open="expanded[group.key] ?? true"
        class="border-b border-border"
        :data-group="group.key"
        @update:open="emit('update:expanded', group.key, $event)"
      >
        <template #label>
          <span class="flex min-w-0 flex-col">
            <span>{{ group.label }}</span>
            <span v-if="group.detail" class="truncate text-[11px] font-normal text-muted">{{
              group.detail
            }}</span>
          </span>
        </template>
        <template v-if="group.toggle || $slots['group-actions']" #actions>
          <span class="flex items-center gap-2">
            <slot name="group-actions" :group="group" />
            <AppSwitch
              v-if="group.toggle"
              :model-value="group.toggle.enabled"
              :state="group.toggle.state"
              :label="group.label"
              @update:model-value="emit('set-group', group.key, $event)"
            />
          </span>
        </template>
        <p v-if="!group.items.length" class="py-3 text-xs text-muted">
          {{ group.empty }}
        </p>
        <ul v-else class="divide-y divide-border">
          <li
            v-for="item in group.items"
            :key="item.key"
            class="flex items-start gap-3 py-3"
            :data-item="item.name"
          >
            <div class="min-w-0 flex-1">
              <button
                v-if="openLabel"
                type="button"
                class="cursor-pointer text-left hover:text-primary"
                @click="emit('open', group.key, item.key)"
              >
                <code class="break-all text-xs font-medium text-surface">{{ item.name }}</code>
              </button>
              <code v-else class="break-all text-xs font-medium text-surface">{{ item.name }}</code>
              <p class="mt-1 line-clamp-2 text-xs leading-relaxed text-muted">
                {{ item.description }}
              </p>
              <p v-if="item.note" class="mt-1 text-[11px] text-warning">{{ item.note }}</p>
            </div>
            <!-- The button is taller than the switch; lifting the pair keeps the switch in line. -->
            <span v-if="openLabel" class="-mt-1 flex shrink-0 items-center gap-1">
              <IconButton
                :label="openLabel(item)"
                size="sm"
                @click="emit('open', group.key, item.key)"
              >
                <icon-lucide-chevron-right class="size-3.5" />
              </IconButton>
              <AppSwitch
                :model-value="item.enabled"
                :label="item.name"
                :disabled="item.locked"
                @update:model-value="emit('set-item', group.key, item.key, $event)"
              />
            </span>
            <AppSwitch
              v-else
              :model-value="item.enabled"
              :label="item.name"
              :disabled="item.locked"
              @update:model-value="emit('set-item', group.key, item.key, $event)"
            />
          </li>
        </ul>
      </SettingsDisclosure>
    </template>
  </div>
</template>
