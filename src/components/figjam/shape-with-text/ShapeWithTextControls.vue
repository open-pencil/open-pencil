<script setup lang="ts">
import { tv } from 'tailwind-variants'
import { computed } from 'vue'

import type {
  FigJamColorName,
  FigJamFillMode,
  FigJamLineStyle,
  FigJamTextSize,
  FigJamTypeface
} from '@open-pencil/scene-graph/figjam'
import type { ShapeWithTextType } from '@open-pencil/scene-graph/shape-with-text'
import { useFigJamMessages, useShapeMessages } from '@open-pencil/vue/i18n'

import FigJamPalette from '@/components/figjam/FigJamPalette.vue'
import { typefaceModel, useFigJamTextOptions } from '@/components/figjam/text-options'
import { SHAPE_KIND_ICONS } from '@/components/icons/shapes'
import { useShapeKindLabels } from '@/components/shapes/labels'
import ShapeKindPicker from '@/components/shapes/ShapeKindPicker.vue'
import IconButton from '@/components/ui/button/IconButton.vue'
import PanelFieldGroup from '@/components/ui/panel/PanelFieldGroup.vue'
import AppSelect from '@/components/ui/select/AppSelect.vue'
import theme from '@/theme/figjam/controls'
import selectTheme from '@/theme/select/app'

/**
 * A shape with text's kind, colour, outline and text, as FigJam's selection toolbar sets them:
 * its palette, closed by no colour, with a see-through fill and a dashed outline as toggles,
 * and its text sizes and typefaces.
 */
const { kind, color, fillMode, lineStyle, lineColor, textSize, typeface, labelFont } = defineProps<{
  kind: ShapeWithTextType
  color: FigJamColorName | null
  fillMode: FigJamFillMode
  lineStyle: FigJamLineStyle
  lineColor: FigJamColorName | null
  textSize: FigJamTextSize | null
  typeface: FigJamTypeface | null
  /** The label's font family, which names a face FigJam's typeface menu does not offer. */
  labelFont?: string
}>()
const emit = defineEmits<{
  'update:kind': [value: ShapeWithTextType]
  'update:color': [value: FigJamColorName]
  'update:fillMode': [value: FigJamFillMode]
  'update:lineStyle': [value: FigJamLineStyle]
  'update:lineColor': [value: FigJamColorName]
  'update:textSize': [value: FigJamTextSize]
  'update:typeface': [value: FigJamTypeface]
}>()

const shapes = useShapeMessages()
const figjam = useFigJamMessages()
const label = useShapeKindLabels()
const { sizeOptions, typefaceOptions } = useFigJamTextOptions()
const styles = tv(theme)()
const select = tv(selectTheme)()

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
  <div :class="styles.root()">
    <ShapeKindPicker
      :heading="shapes.kind"
      :selected="kind"
      side="left"
      align="start"
      @select="emit('update:kind', $event)"
    >
      <template #trigger>
        <button
          type="button"
          aria-haspopup="listbox"
          data-property="shape-kind"
          :aria-label="shapes.kind"
          :class="select.trigger()"
        >
          <component :is="SHAPE_KIND_ICONS[kind]" class="mr-1.5 size-4 text-muted" />
          <span :class="select.value()">{{ label(kind) }}</span>
          <icon-lucide-chevron-down class="ml-1 size-3 shrink-0 text-muted" />
        </button>
      </template>
    </ShapeKindPicker>
    <div>
      <div :class="styles.header()">
        <span :class="styles.label()">{{ shapes.fill }}</span>
        <IconButton
          toggle
          :label="shapes.fillTransparent"
          :active="fillMode === 'transparent'"
          data-property="shape-fill-transparent"
          @click="emit('update:fillMode', fillMode === 'transparent' ? 'fill' : 'transparent')"
        >
          <icon-lucide-contrast class="size-3.5" />
        </IconButton>
      </div>
      <FigJamPalette
        :label="shapes.fill"
        :selected="color"
        :none-label="shapes.fillNone"
        :none="fillMode === 'none'"
        @select="emit('update:color', $event)"
        @none="emit('update:fillMode', 'none')"
      />
    </div>
    <div>
      <div :class="styles.header()">
        <span :class="styles.label()">{{ shapes.line }}</span>
        <IconButton
          toggle
          :label="shapes.lineDashed"
          :active="lineStyle === 'dashed'"
          data-property="shape-line-dashed"
          @click="emit('update:lineStyle', lineStyle === 'dashed' ? 'solid' : 'dashed')"
        >
          <icon-lucide-circle-dashed class="size-3.5" />
        </IconButton>
      </div>
      <FigJamPalette
        :label="shapes.line"
        :selected="lineColor"
        :none-label="shapes.lineNone"
        :none="lineStyle === 'none'"
        @select="emit('update:lineColor', $event)"
        @none="emit('update:lineStyle', 'none')"
      />
    </div>
    <PanelFieldGroup :label="figjam.textSize">
      <AppSelect
        v-model="selectedSize"
        :label="figjam.textSize"
        :options="sizeOptions"
        data-property="shape-text-size"
      />
    </PanelFieldGroup>
    <PanelFieldGroup :label="figjam.typeface">
      <AppSelect
        v-model="selectedTypeface"
        :label="figjam.typeface"
        :placeholder="labelFont ?? figjam.typeface"
        :options="typefaceOptions"
        data-property="shape-typeface"
      />
    </PanelFieldGroup>
  </div>
</template>
