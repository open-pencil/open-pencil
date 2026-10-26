<script setup lang="ts">
import IconButton from '@/components/ui/button/IconButton.vue'
import Tip from '@/components/ui/overlay/Tip.vue'
import AppSwitch from '@/components/ui/toggle/AppSwitch.vue'

import type { CapabilityGroup, CapabilityItem } from './types'

/**
 * Groups of things the AI can use as one dense list, as Linear lists issues: a row per group with
 * its switch, then a row per item with its switch, name, and description on one line. Given
 * `openLabel`, a row's › opens the item's details.
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
  /** Buttons at the end of a group's row, such as Trust folder. */
  'group-actions'?: (props: { group: CapabilityGroup }) => unknown
}>()

function isOpen(group: CapabilityGroup) {
  return expanded[group.key] ?? true
}
</script>

<template>
  <div
    class="@container/capabilities overflow-hidden rounded border border-border text-xs"
    data-slot="capability-list"
  >
    <template v-for="group in groups" :key="group.key">
      <section
        v-if="group.items.length || group.empty"
        class="border-border not-first:border-t"
        :data-group="group.key"
        :aria-label="group.label"
      >
        <div class="flex min-h-8 items-center gap-3 bg-panel-secondary px-3 py-1">
          <span class="flex w-7 shrink-0">
            <AppSwitch
              v-if="group.toggle"
              :model-value="group.toggle.enabled"
              :state="group.toggle.state"
              :label="group.label"
              @update:model-value="emit('set-group', group.key, $event)"
            />
          </span>
          <button
            type="button"
            class="flex min-w-0 flex-1 cursor-pointer items-center gap-1.5 text-left"
            :aria-expanded="isOpen(group)"
            @click="emit('update:expanded', group.key, !isOpen(group))"
          >
            <icon-lucide-chevron-right
              class="size-3 shrink-0 text-muted transition-transform"
              :class="isOpen(group) && 'rotate-90'"
              aria-hidden="true"
            />
            <span class="shrink-0 font-semibold text-surface">{{ group.label }}</span>
            <code v-if="group.detail" class="min-w-0 truncate text-[11px] text-muted">{{
              group.detail
            }}</code>
          </button>
          <span v-if="group.count" class="shrink-0 text-[11px] text-muted">{{ group.count }}</span>
          <slot name="group-actions" :group="group" />
        </div>
        <template v-if="isOpen(group)">
          <p
            v-if="!group.items.length"
            class="border-t border-border py-2 pr-3 pl-13 text-[11px] text-muted"
          >
            {{ group.empty }}
          </p>
          <ul v-else>
            <li
              v-for="item in group.items"
              :key="item.key"
              class="flex min-h-8 items-center gap-3 border-t border-border px-3 py-1 @max-md/capabilities:flex-wrap"
              :data-item="item.name"
            >
              <span class="flex w-7 shrink-0">
                <AppSwitch
                  :model-value="item.enabled"
                  :label="item.name"
                  :disabled="item.locked"
                  @update:model-value="emit('set-item', group.key, item.key, $event)"
                />
              </span>
              <code
                class="w-40 shrink-0 truncate font-medium text-surface @max-md/capabilities:flex-1"
                >{{ item.name }}</code
              >
              <!-- One line each, so the full text is a hover away. -->
              <Tip :label="item.description" as-child>
                <span
                  class="min-w-0 flex-1 truncate text-muted @max-md/capabilities:order-last @max-md/capabilities:basis-full @max-md/capabilities:pl-10"
                  >{{ item.description }}</span
                >
              </Tip>
              <span v-if="item.note" class="shrink-0 text-[11px] text-warning">{{
                item.note
              }}</span>
              <IconButton
                v-if="openLabel"
                :label="openLabel(item)"
                size="xs"
                class="shrink-0"
                @click="emit('open', group.key, item.key)"
              >
                <icon-lucide-chevron-right class="size-3.5" />
              </IconButton>
            </li>
          </ul>
        </template>
      </section>
    </template>
  </div>
</template>
