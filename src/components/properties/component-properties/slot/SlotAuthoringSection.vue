<script setup lang="ts">
import { reactive, watch } from 'vue'

import { useI18n, useSlotAuthoring } from '@open-pencil/vue'

import AssetThumbnail from '@/components/assets-panel/AssetThumbnail.vue'
import AppButton from '@/components/ui/button/AppButton.vue'
import IconButton from '@/components/ui/button/IconButton.vue'
import AppInput from '@/components/ui/input/AppInput.vue'
import PanelSection from '@/components/ui/panel/PanelSection.vue'

import SlotSettingsPopover from './SlotSettingsPopover.vue'

/** Slots of the selected main component or slot frame, and Create slot for a plain frame. */
const authoring = useSlotAuthoring()
const { active, canCreate, slots } = authoring
const { panels } = useI18n()
const names = reactive<Record<string, string>>({})
/** Thumbnail edge in the preferred components picker, matching its 32px tile. */
const THUMBNAIL_SIZE = 32

watch(
  slots,
  (items) => {
    for (const slot of items) names[slot.id] = slot.name
  },
  { immediate: true }
)

function commitName(propertyId: string) {
  const name = names[propertyId]?.trim()
  const slot = slots.value.find((item) => item.id === propertyId)
  if (!slot) return
  if (name && name !== slot.name) authoring.rename(propertyId, name)
  else names[propertyId] = slot.name
}

function blurInput(event: KeyboardEvent) {
  const target = event.currentTarget
  if (target instanceof HTMLInputElement) target.blur()
}
</script>

<template>
  <PanelSection v-if="active" :label="panels.slots">
    <div class="flex flex-col gap-1.5">
      <AppButton
        v-if="canCreate"
        variant="soft"
        class="self-start"
        data-property="create-slot"
        @click="authoring.create()"
      >
        <icon-lucide-square-dashed class="size-3.5 text-slot" />
        {{ panels.createSlot }}
      </AppButton>
      <div
        v-for="slot in slots"
        :key="slot.id"
        class="flex items-center gap-1"
        :data-property="`slot-definition-${slot.name}`"
      >
        <AppInput
          v-model="names[slot.id]"
          size="sm"
          tone="panel"
          class="flex-1"
          :aria-label="panels.slotName"
          @change="commitName(slot.id)"
          @enter="blurInput"
        />
        <SlotSettingsPopover
          :slot="slot"
          :options="authoring.options(slot.id)"
          @describe="authoring.describe(slot.id, $event)"
          @set-limits="authoring.setLimits(slot.id, $event)"
          @set-preferred-only="authoring.setPreferredOnly(slot.id, $event)"
          @set-preferred="(id, preferred) => authoring.setPreferred(slot.id, id, preferred)"
        >
          <template #thumbnail="{ id }">
            <AssetThumbnail :node-id="id" alt="" :size="THUMBNAIL_SIZE" />
          </template>
        </SlotSettingsPopover>
        <IconButton :label="panels.removeSlot" @click="authoring.remove(slot.id)">
          <icon-lucide-minus class="size-3.5" />
        </IconButton>
      </div>
    </div>
  </PanelSection>
</template>
