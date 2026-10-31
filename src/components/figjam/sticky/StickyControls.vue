<script setup lang="ts">
import { tv } from 'tailwind-variants'
import { computed } from 'vue'

import type { FigJamTextSize, FigJamTypeface } from '@open-pencil/scene-graph/figjam'
import { STICKY_COLORS } from '@open-pencil/scene-graph/generated'
import type { Color } from '@open-pencil/scene-graph/primitives'
import { useFigJamMessages, useI18n } from '@open-pencil/vue/i18n'

import FigJamSwatches from '@/components/figjam/FigJamSwatches.vue'
import { useStickySwatches } from '@/components/figjam/sticky/swatches'
import { typefaceModel, useFigJamTextOptions } from '@/components/figjam/text-options'
import PanelFieldGroup from '@/components/ui/panel/PanelFieldGroup.vue'
import AppSelect from '@/components/ui/select/AppSelect.vue'
import AppSwitch from '@/components/ui/toggle/AppSwitch.vue'
import stickyControlsTheme from '@/theme/sticky-controls'

const { color, textSize, authorVisible, typeface, bodyFont } = defineProps<{
  color: Color | null
  textSize: FigJamTextSize | null
  authorVisible: boolean
  typeface: FigJamTypeface | null
  /** The body's font family, which names a face FigJam's typeface menu does not offer. */
  bodyFont?: string
}>()

const emit = defineEmits<{
  'update:color': [value: Color]
  'update:textSize': [value: FigJamTextSize]
  'update:authorVisible': [value: boolean]
  'update:typeface': [value: FigJamTypeface]
}>()

const { panels } = useI18n()
const figjam = useFigJamMessages()
const styles = tv(stickyControlsTheme)

const { swatches, selected: selectedColor } = useStickySwatches(() => color)

const { sizeOptions, typefaceOptions } = useFigJamTextOptions()

const selectedSize = computed<FigJamTextSize>({
  get: () => textSize ?? 'small',
  set: (value) => emit('update:textSize', value)
})

const selectedTypeface = typefaceModel(
  () => typeface,
  (value) => emit('update:typeface', value)
)
</script>

<template>
  <div :class="styles().root()">
    <PanelFieldGroup :label="panels.stickyColor">
      <FigJamSwatches
        :label="panels.stickyColor"
        :swatches="swatches"
        :selected="selectedColor"
        @select="emit('update:color', STICKY_COLORS[$event])"
      />
    </PanelFieldGroup>
    <PanelFieldGroup :label="figjam.textSize">
      <AppSelect
        v-model="selectedSize"
        :label="figjam.textSize"
        :options="sizeOptions"
        data-property="sticky-text-size"
      />
    </PanelFieldGroup>
    <PanelFieldGroup :label="figjam.typeface">
      <AppSelect
        v-model="selectedTypeface"
        :label="figjam.typeface"
        :placeholder="bodyFont ?? figjam.typeface"
        :options="typefaceOptions"
        data-property="sticky-typeface"
      />
    </PanelFieldGroup>
    <label :class="styles().option()">
      <span>{{ panels.stickyShowAuthor }}</span>
      <AppSwitch
        :model-value="authorVisible"
        :label="panels.stickyShowAuthor"
        data-property="sticky-show-author"
        @update:model-value="emit('update:authorVisible', $event)"
      />
    </label>
  </div>
</template>
