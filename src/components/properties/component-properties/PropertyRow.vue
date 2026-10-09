<script setup lang="ts">
import { PopoverClose, PopoverContent, PopoverPortal, PopoverRoot, PopoverTrigger } from 'reka-ui'
import { computed, ref, watch } from 'vue'

import type { ComponentPropertyType } from '@open-pencil/scene-graph'
import { useI18n, useRetainedPopup } from '@open-pencil/vue'
import type { ComponentBinding, ComponentBindingGroup } from '@open-pencil/vue'

import AppButton from '@/components/ui/button/AppButton.vue'
import AppInput from '@/components/ui/input/AppInput.vue'
import { usePopoverUI } from '@/components/ui/overlay/popover'
import PanelFieldGroup from '@/components/ui/panel/PanelFieldGroup.vue'

import PropertyBindings from './PropertyBindings.vue'
import PropertyTypeIcon from './PropertyTypeIcon.vue'
import PropertyValueField from './PropertyValueField.vue'

/** One property of a main component: a single row that opens its settings. */
const {
  name,
  kind,
  value,
  valueLabel,
  options = [],
  groups = [],
  totalVariants = 0,
  disabled
} = defineProps<{
  name: string
  kind: ComponentPropertyType
  value: string
  /** The default as people read it, e.g. a component name for a swap. */
  valueLabel: string
  options?: { value: string; label: string; disabled?: boolean }[]
  groups?: ComponentBindingGroup[]
  totalVariants?: number
  disabled?: boolean
}>()
defineSlots<{ default?(): unknown }>()
const emit = defineEmits<{
  rename: [name: string]
  update: [value: string]
  remove: []
  select: [id: string]
  unbind: [binding: ComponentBinding]
}>()
const { panels, common } = useI18n()
const { open, portalActive } = useRetainedPopup()
const styles = usePopoverUI({
  content: 'w-64 max-w-[calc(100vw-1rem)]',
  header: 'flex items-center gap-1.5 border-b border-border px-3 py-2',
  body: 'flex flex-col gap-3 p-3',
  footer: 'flex border-t border-border px-3 py-2'
})
const draftName = ref(name)
watch(
  () => name,
  (next) => {
    draftName.value = next
  }
)
function commitName() {
  const next = draftName.value.trim()
  if (next && next !== name) emit('rename', next)
  else draftName.value = name
}
const shownValue = computed(() => {
  if (kind !== 'BOOLEAN') return valueLabel
  return value === 'true' ? panels.value.propertyOn : panels.value.propertyOff
})
</script>

<template>
  <PopoverRoot v-model:open="open">
    <PopoverTrigger as-child>
      <button
        type="button"
        class="group/row flex h-7 w-full min-w-0 items-center gap-1.5 rounded px-1.5 text-left text-xs hover:bg-hover data-[state=open]:bg-hover"
        :data-property-row="name"
      >
        <PropertyTypeIcon :kind="kind" />
        <span class="shrink-0 truncate text-surface">{{ name }}</span>
        <span class="min-w-0 truncate text-muted">· {{ shownValue }}</span>
      </button>
    </PopoverTrigger>
    <PopoverPortal v-if="portalActive">
      <PopoverContent
        side="left"
        align="start"
        :side-offset="8"
        :aria-label="name"
        :class="styles.content"
        @focus-outside.prevent
      >
        <div :class="styles.header">
          <PropertyTypeIcon :kind="kind" />
          <h3 class="truncate text-xs font-semibold text-surface">{{ name }}</h3>
          <PopoverClose as-child>
            <AppButton :aria-label="common.close" class="ml-auto">
              <icon-lucide-x class="size-3.5" />
            </AppButton>
          </PopoverClose>
        </div>
        <div :class="styles.body">
          <PanelFieldGroup :label="panels.componentPropertyName">
            <AppInput
              v-model="draftName"
              size="sm"
              tone="panel"
              :aria-label="panels.componentPropertyName"
              :disabled="disabled"
              @change="commitName"
              @enter="commitName"
            />
          </PanelFieldGroup>
          <!-- A variant property edits its values here instead of a default. -->
          <slot>
            <PanelFieldGroup :label="panels.componentPropertyDefault">
              <div class="flex">
                <PropertyValueField
                  :kind="kind"
                  :value="value"
                  :label="panels.componentPropertyDefault"
                  :options="options"
                  :disabled="disabled"
                  @update="emit('update', $event)"
                />
              </div>
            </PanelFieldGroup>
          </slot>
          <PanelFieldGroup v-if="groups.length" :label="panels.layers">
            <div class="flex flex-col gap-0.5">
              <PropertyBindings
                :groups="groups"
                :total-variants="totalVariants"
                :disabled="disabled"
                @select="emit('select', $event)"
                @unbind="emit('unbind', $event)"
              />
            </div>
          </PanelFieldGroup>
        </div>
        <div :class="styles.footer">
          <AppButton
            size="xs"
            variant="ghost"
            :disabled="disabled"
            class="text-issue-error"
            @click="emit('remove')"
          >
            <icon-lucide-trash-2 class="size-3.5" />
            {{ panels.deleteComponentProperty }}
          </AppButton>
        </div>
      </PopoverContent>
    </PopoverPortal>
  </PopoverRoot>
</template>
