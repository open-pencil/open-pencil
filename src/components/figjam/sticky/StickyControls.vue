<script setup lang="ts">
import { tv } from 'tailwind-variants'
import { computed } from 'vue'

import { colorToHex } from '@open-pencil/scene-graph/color'
import type { FigJamTextSize, FigJamTypeface } from '@open-pencil/scene-graph/figjam'
import { STICKY_COLORS } from '@open-pencil/scene-graph/generated'
import type { Color } from '@open-pencil/scene-graph/primitives'
import { useFigJamMessages, useI18n } from '@open-pencil/vue/i18n'

import FigJamSwatches from '@/components/figjam/FigJamSwatches.vue'
import { typefaceModel, useFigJamTextOptions } from '@/components/figjam/text-options'
import PanelFieldGroup from '@/components/ui/panel/PanelFieldGroup.vue'
import AppSelect from '@/components/ui/select/AppSelect.vue'
import AppSwitch from '@/components/ui/toggle/AppSwitch.vue'
import stickyControlsTheme from '@/theme/sticky-controls'

type StickyColorName = keyof typeof STICKY_COLORS

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

const COLOR_LABEL_KEYS = {
  white: 'stickyColorWhite',
  gray: 'stickyColorGray',
  red: 'stickyColorRed',
  orange: 'stickyColorOrange',
  yellow: 'stickyColorYellow',
  green: 'stickyColorGreen',
  teal: 'stickyColorTeal',
  blue: 'stickyColorBlue',
  violet: 'stickyColorViolet',
  pink: 'stickyColorPink'
} as const satisfies Record<StickyColorName, string>

const swatches = computed(() =>
  (Object.entries(STICKY_COLORS) as [StickyColorName, Color][]).map(([name, value]) => ({
    value: name,
    hex: colorToHex(value),
    label: panels.value[COLOR_LABEL_KEYS[name]]
  }))
)
const selectedColor = computed(
  () =>
    swatches.value.find((swatch) => color !== null && swatch.hex === colorToHex(color))?.value ??
    null
)

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
