<script setup lang="ts">
import { ref } from 'vue'

import type { Fill } from '@open-pencil/scene-graph'

import PropertyListAdd from '#vue/primitives/PropertyList/PropertyListAdd.vue'
import PropertyListItem from '#vue/primitives/PropertyList/PropertyListItem.vue'
import PropertyListRemove from '#vue/primitives/PropertyList/PropertyListRemove.vue'
import PropertyListRoot from '#vue/primitives/PropertyList/PropertyListRoot.vue'
import PropertyListVisibility from '#vue/primitives/PropertyList/PropertyListVisibility.vue'
import PropertySectionActions from '#vue/primitives/PropertySection/PropertySectionActions.vue'
import PropertySectionContent from '#vue/primitives/PropertySection/PropertySectionContent.vue'
import PropertySectionEmptyAction from '#vue/primitives/PropertySection/PropertySectionEmptyAction.vue'
import PropertySectionHeader from '#vue/primitives/PropertySection/PropertySectionHeader.vue'
import PropertySectionRoot from '#vue/primitives/PropertySection/PropertySectionRoot.vue'
import PropertySectionTitle from '#vue/primitives/PropertySection/PropertySectionTitle.vue'
import SegmentedControlItem from '#vue/primitives/SegmentedControl/SegmentedControlItem.vue'
import SegmentedControlRoot from '#vue/primitives/SegmentedControl/SegmentedControlRoot.vue'

const alignment = ref('left')
const empty = ref(true)
const lastAction = ref('None')
const defaultFill: Fill = {
  type: 'SOLID',
  color: { r: 0.4, g: 0.5, b: 1, a: 1 },
  opacity: 1,
  visible: true,
  blendMode: 'NORMAL'
}
const fills = ref<Fill[]>([
  structuredClone(defaultFill),
  { ...structuredClone(defaultFill), visible: false }
])

function addFill(fill: Fill) {
  fills.value.push(structuredClone(fill))
}

function removeFill(index: number) {
  fills.value.splice(index, 1)
}

function toggleFill(index: number) {
  const fill = fills.value[index]
  if (fill) fill.visible = !fill.visible
}
</script>

<template>
  <div
    class="grid w-full max-w-[620px] gap-4 rounded-lg border border-[var(--vp-c-divider)] bg-[var(--vp-c-bg-soft)] p-5 text-xs text-[var(--vp-c-text-1)] sm:grid-cols-2"
  >
    <div class="space-y-3">
      <PropertySectionRoot
        class="rounded border border-[var(--vp-c-divider)]"
        aria-label="Layer section"
      >
        <PropertySectionHeader class="flex items-center justify-between px-3 py-2">
          <PropertySectionTitle class="font-semibold">Layer</PropertySectionTitle>
          <PropertySectionActions class="text-[var(--vp-c-text-2)]">⌘ L</PropertySectionActions>
        </PropertySectionHeader>
        <PropertySectionContent class="border-t border-[var(--vp-c-divider)] px-3 py-2">
          Collapsible content
        </PropertySectionContent>
      </PropertySectionRoot>

      <PropertySectionRoot
        :empty="empty"
        class="rounded border border-[var(--vp-c-divider)] px-3 py-2"
      >
        <PropertySectionHeader>
          <PropertySectionTitle class="font-semibold">Effects</PropertySectionTitle>
        </PropertySectionHeader>
        <PropertySectionContent>
          <PropertySectionEmptyAction
            class="mt-2 rounded bg-[var(--vp-c-bg-alt)] px-2 py-1"
            @activate="empty = false"
          >
            Add first effect
          </PropertySectionEmptyAction>
          <p v-if="!empty" class="mt-2 text-[var(--vp-c-text-2)]">Drop shadow</p>
        </PropertySectionContent>
      </PropertySectionRoot>
    </div>

    <div class="space-y-3">
      <SegmentedControlRoot
        v-model="alignment"
        aria-label="Alignment"
        class="grid grid-cols-3 rounded bg-[var(--vp-c-bg-alt)] p-0.5"
      >
        <SegmentedControlItem
          v-for="value in ['left', 'center', 'right']"
          :key="value"
          :value="value"
          class="rounded px-2 py-1 capitalize data-[state=on]:bg-[var(--vp-c-bg-soft)]"
        >
          {{ value }}
        </SegmentedControlItem>
      </SegmentedControlRoot>

      <SegmentedControlRoot
        mode="action"
        aria-label="Transform actions"
        class="grid grid-cols-3 rounded bg-[var(--vp-c-bg-alt)] p-0.5"
        @action="lastAction = $event"
      >
        <SegmentedControlItem
          v-for="value in ['flip-x', 'flip-y', 'rotate-90']"
          :key="value"
          :value="value"
          class="rounded px-2 py-1"
        >
          {{ value }}
        </SegmentedControlItem>
      </SegmentedControlRoot>
      <p aria-live="polite" class="text-[var(--vp-c-text-2)]">Action: {{ lastAction }}</p>
    </div>

    <PropertyListRoot
      v-slot="{ items }"
      prop-key="fills"
      :items="fills"
      @add="addFill"
      @remove="removeFill"
      @toggle-visibility="toggleFill"
    >
      <div class="space-y-1 rounded border border-[var(--vp-c-divider)] p-2 sm:col-span-2">
        <PropertyListItem
          v-for="(_, index) in items"
          :key="index"
          v-slot="{ hidden }"
          prop-key="fills"
          :index="index"
          class="flex items-center gap-2 rounded bg-[var(--vp-c-bg-alt)] px-2 py-1 data-[hidden]:opacity-50"
        >
          <span class="min-w-0 flex-1 truncate">Fill {{ index + 1 }}</span>
          <PropertyListVisibility prop-key="fills" :index="index">
            {{ hidden ? 'Show' : 'Hide' }}
          </PropertyListVisibility>
          <PropertyListRemove prop-key="fills" :index="index">Remove</PropertyListRemove>
        </PropertyListItem>
        <PropertyListAdd
          prop-key="fills"
          :item="defaultFill"
          class="rounded bg-[var(--vp-c-bg-alt)] px-2 py-1"
        >
          Add fill
        </PropertyListAdd>
      </div>
    </PropertyListRoot>
  </div>
</template>
