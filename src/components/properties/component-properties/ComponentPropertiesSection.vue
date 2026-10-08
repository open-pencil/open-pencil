<script setup lang="ts">
import { computed } from 'vue'

import {
  useComponentProperties,
  useExposedInstances,
  useI18n,
  useSlotProperties
} from '@open-pencil/vue'

import AssetThumbnail from '@/components/assets-panel/AssetThumbnail.vue'
import PanelSection from '@/components/ui/panel/PanelSection.vue'

import ComponentPropertyControl from './ComponentPropertyControl.vue'
import ComponentPropertyRow from './ComponentPropertyRow.vue'
import ExposedInstanceGroup from './ExposedInstanceGroup.vue'
import SlotPropertyRow from './slot/SlotPropertyRow.vue'

const { active, controls, setValue, setTextValue, flush } = useComponentProperties()
const exposedGroups = useExposedInstances()
const slotProperties = useSlotProperties()
const slots = slotProperties.slots
const visible = computed(
  () => active.value || exposedGroups.value.length > 0 || slots.value.length > 0
)
/** Thumbnail edge in the Add instances list, matching the picker's 32px tile. */
const SLOT_THUMBNAIL_SIZE = 32
const { panels } = useI18n()
const componentSectionUI = { title: 'text-component' }

const sectionLabel = computed(() =>
  slots.value.length === 0 &&
  exposedGroups.value.length === 0 &&
  controls.value.every((control) => control.type === 'VARIANT')
    ? panels.value.variants
    : panels.value.componentProperties
)
</script>

<template>
  <PanelSection v-if="visible" :label="sectionLabel" :ui="componentSectionUI">
    <div class="flex flex-col gap-1">
      <ComponentPropertyRow v-for="control in controls" :key="control.id" :name="control.name">
        <ComponentPropertyControl
          :control="control"
          @set="setValue"
          @text="setTextValue"
          @flush="flush"
        />
      </ComponentPropertyRow>
      <ExposedInstanceGroup
        v-for="group in exposedGroups"
        :key="group.id"
        :instance-id="group.id"
        :name="group.name"
      />
      <SlotPropertyRow
        v-for="slot in slots"
        :key="slot.id"
        :name="slot.name"
        :modified="slot.modified"
        :item-count="slot.itemCount"
        :limits="slot.limits"
        :options="slotProperties.options(slot.id)"
        :preferred-only="slot.preferredOnly"
        @add="slotProperties.add(slot.frameId, $event)"
        @reset="slotProperties.reset(slot.frameId)"
        @delete-contents="slotProperties.clear(slot.frameId)"
        @select-layers="slotProperties.selectLayers(slot.offendingIds)"
      >
        <template #thumbnail="{ id }">
          <AssetThumbnail :node-id="id" alt="" :size="SLOT_THUMBNAIL_SIZE" />
        </template>
      </SlotPropertyRow>
    </div>
  </PanelSection>
</template>
