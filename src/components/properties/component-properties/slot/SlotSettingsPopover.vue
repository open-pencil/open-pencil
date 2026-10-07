<script setup lang="ts">
import { PopoverClose, PopoverContent, PopoverPortal, PopoverRoot, PopoverTrigger } from 'reka-ui'
import { computed, ref, watch } from 'vue'

import { useI18n, useRetainedPopup } from '@open-pencil/vue'
import type { SlotDefinitionControl, SlotInstanceOption } from '@open-pencil/vue'

import AppButton from '@/components/ui/button/AppButton.vue'
import IconButton from '@/components/ui/button/IconButton.vue'
import AppInput from '@/components/ui/input/AppInput.vue'
import AppTextarea from '@/components/ui/input/AppTextarea.vue'
import { usePopoverUI } from '@/components/ui/overlay/popover'
import PanelFieldGroup from '@/components/ui/panel/PanelFieldGroup.vue'
import AppPicker, { type AppPickerItem } from '@/components/ui/select/AppPicker.vue'
import AppSwitch from '@/components/ui/toggle/AppSwitch.vue'

/** A main component's slot settings: description, layer limits, and preferred components. */
const { slot, options } = defineProps<{
  slot: SlotDefinitionControl
  options: SlotInstanceOption[]
}>()
const emit = defineEmits<{
  describe: [description: string]
  setLimits: [limits: { minChildren?: number; maxChildren?: number }]
  setPreferredOnly: [value: boolean]
  setPreferred: [componentId: string, preferred: boolean]
}>()
defineSlots<{ thumbnail?(props: { id: string }): unknown }>()
const { panels, common } = useI18n()
const { open: popupOpen, portalActive } = useRetainedPopup()
const styles = usePopoverUI({
  content: 'w-64 max-w-[calc(100vw-1rem)]',
  header: 'flex items-center gap-1.5 border-b border-border px-3 py-2',
  body: 'flex flex-col gap-3 p-3'
})

const description = ref(slot.description)
const minimum = ref<string | number>(slot.minChildren ?? '')
const maximum = ref<string | number>(slot.maxChildren ?? '')
watch(
  () => slot,
  (current) => {
    description.value = current.description
    minimum.value = current.minChildren ?? ''
    maximum.value = current.maxChildren ?? ''
  }
)

/** A limit field's value: a whole number of layers, or none when left empty. */
function limit(value: string | number): number | undefined {
  const parsed = typeof value === 'number' ? value : Number.parseInt(value, 10)
  return Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : undefined
}

function commitLimits() {
  emit('setLimits', { minChildren: limit(minimum.value), maxChildren: limit(maximum.value) })
}

function commitDescription() {
  const next = description.value.trim()
  description.value = next
  if (next !== slot.description) emit('describe', next)
}

const candidates = computed<AppPickerItem[]>(() =>
  options
    .filter((option) => !option.preferred)
    .map((option) => ({ value: option.id, label: option.name, description: option.source }))
)
</script>

<template>
  <PopoverRoot v-model:open="popupOpen">
    <PopoverTrigger as-child>
      <IconButton :label="panels.slotSettings" data-property="slot-settings">
        <icon-lucide-sliders-horizontal class="size-3.5" />
      </IconButton>
    </PopoverTrigger>
    <PopoverPortal v-if="portalActive">
      <PopoverContent
        side="left"
        align="start"
        :side-offset="8"
        :aria-label="panels.slotSettings"
        :class="styles.content"
        @focus-outside.prevent
      >
        <div :class="styles.header">
          <icon-lucide-square-dashed class="size-3.5 text-slot" />
          <h3 class="truncate text-xs font-semibold text-surface">{{ slot.name }}</h3>
          <PopoverClose as-child>
            <AppButton :aria-label="common.close" class="ml-auto">
              <icon-lucide-x class="size-3.5" />
            </AppButton>
          </PopoverClose>
        </div>
        <div :class="styles.body">
          <PanelFieldGroup :label="panels.slotDescription">
            <AppTextarea
              v-model="description"
              :rows="2"
              :aria-label="panels.slotDescription"
              @blur="commitDescription"
            />
          </PanelFieldGroup>
          <div class="grid grid-cols-2 gap-2">
            <PanelFieldGroup :label="panels.slotMinimum">
              <AppInput
                v-model="minimum"
                type="number"
                size="sm"
                tone="panel"
                :min="0"
                :placeholder="panels.slotNoLimit"
                :aria-label="panels.slotMinimum"
                data-property="slot-minimum"
                @change="commitLimits"
              />
            </PanelFieldGroup>
            <PanelFieldGroup :label="panels.slotMaximum">
              <AppInput
                v-model="maximum"
                type="number"
                size="sm"
                tone="panel"
                :min="0"
                :placeholder="panels.slotNoLimit"
                :aria-label="panels.slotMaximum"
                data-property="slot-maximum"
                @change="commitLimits"
              />
            </PanelFieldGroup>
          </div>
          <PanelFieldGroup :label="panels.preferredInstances">
            <ul class="flex flex-col gap-0.5">
              <li
                v-for="option in slot.preferred"
                :key="option.id"
                class="flex h-7 items-center gap-1.5 rounded px-1 text-xs text-surface hover:bg-hover"
              >
                <icon-lucide-diamond class="size-3.5 shrink-0 text-component" />
                <span class="min-w-0 flex-1 truncate">{{ option.name }}</span>
                <IconButton
                  :label="panels.removePreferredInstance"
                  @click="emit('setPreferred', option.id, false)"
                >
                  <icon-lucide-minus class="size-3.5" />
                </IconButton>
              </li>
            </ul>
            <AppPicker
              :heading="panels.addPreferredInstances"
              :items="candidates"
              :search-placeholder="panels.searchInstances"
              :empty-label="panels.noInstancesFound"
              :close-label="common.close"
              @select="emit('setPreferred', $event, true)"
            >
              <template #trigger>
                <AppButton variant="soft" class="self-start" data-property="slot-add-preferred">
                  <icon-lucide-plus class="size-3.5" />
                  {{ panels.addPreferredInstances }}
                </AppButton>
              </template>
              <template #leading="{ item }">
                <slot name="thumbnail" :id="item.value">
                  <icon-lucide-component class="size-3.5" />
                </slot>
              </template>
            </AppPicker>
          </PanelFieldGroup>
          <label class="flex items-center justify-between gap-2 text-xs text-surface">
            {{ panels.slotPreferredOnly }}
            <AppSwitch
              :model-value="slot.preferredOnly"
              :label="panels.slotPreferredOnly"
              @update:model-value="emit('setPreferredOnly', $event)"
            />
          </label>
        </div>
      </PopoverContent>
    </PopoverPortal>
  </PopoverRoot>
</template>
