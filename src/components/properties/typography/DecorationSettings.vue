<script setup lang="ts">
import { computed } from 'vue'

import { BLACK } from '@open-pencil/core/constants'
import { automaticUnderline } from '@open-pencil/core/text'
import type { Fill, SceneNode, TextDecoration, TextDecorationStyle } from '@open-pencil/scene-graph'
import type { Color } from '@open-pencil/scene-graph/primitives'
import { panelFieldBase } from '@open-pencil/theme'
import { MIXED, type MixedValue } from '@open-pencil/vue/controls/node-props'
import { useMessages } from '@open-pencil/vue/i18n'
import { useRetainedPopup } from '@open-pencil/vue/lifecycle/retention'

import ColorPicker from '@/components/ColorPicker/ColorPicker.vue'
import NumberField from '@/components/inputs/NumberField.vue'
import PaintField from '@/components/inputs/PaintField.vue'
import PaintValue from '@/components/properties/paint/PaintValue.vue'
import IconButton from '@/components/ui/button/IconButton.vue'
import PanelFieldGroup from '@/components/ui/panel/PanelFieldGroup.vue'
import PanelGrid from '@/components/ui/panel/PanelGrid.vue'
import AppSelect from '@/components/ui/select/AppSelect.vue'
import AppSelectContent from '@/components/ui/select/AppSelectContent.vue'
import AppSelectItem from '@/components/ui/select/AppSelectItem.vue'
import AppSelectRoot from '@/components/ui/select/AppSelectRoot.vue'
import SelectFieldTrigger from '@/components/ui/select/SelectFieldTrigger.vue'
import AppSwitch from '@/components/ui/toggle/AppSwitch.vue'

type LengthKey = 'textDecorationThickness' | 'textUnderlineOffset'
/** The fields the settings preview while they are dragged or typed, and then commit. */
type DecorationKey = LengthKey | 'textDecorationFills'

/**
 * The settings of the decoration every selected text shares, as Figma's underline details hold
 * them: an underline's style, thickness, offset, and ink skipping, and either decoration's colour.
 */
const { node, decoration, decorationStyle, skipInk, fills, thickness, offset } = defineProps<{
  /** The first selected text, as the panel shows it, which automatic values are measured on. */
  node: SceneNode
  decoration: TextDecoration
  decorationStyle: TextDecorationStyle | ''
  skipInk: boolean | ''
  /** The decoration's own paints, empty when it takes the text's fill. */
  fills: Fill[] | null
  /** The selected texts' thickness and offset: null is automatic, MIXED where they differ. */
  thickness: MixedValue<number | null>
  offset: MixedValue<number | null>
}>()
const emit = defineEmits<{
  style: [value: TextDecorationStyle]
  skipInk: [value: boolean]
  /** A change shown while it is made, which `commit` records as one undo step. */
  update: [key: DecorationKey, value: number | null | Fill[]]
  commit: [key: DecorationKey]
  cancel: [key: DecorationKey]
}>()

const panels = useMessages('panels')
const typography = useMessages('panels/typography')
const thicknessPopup = useRetainedPopup()
const offsetPopup = useRetainedPopup()

const underline = computed(() => decoration === 'UNDERLINE')
const automatic = computed(() => automaticUnderline(node))
const styleOptions = computed(() => [
  { value: 'SOLID', label: typography.value.decorationSolid },
  { value: 'DOTTED', label: typography.value.decorationDotted },
  { value: 'WAVY', label: typography.value.decorationWavy }
])
/** One of the underline's lengths: its field, its value across the selection, and Auto's value. */
interface LengthRow {
  key: LengthKey
  label: string
  modeLabel: string
  value: MixedValue<number | null>
  automatic: number
  popup: ReturnType<typeof useRetainedPopup>
}

const lengths = computed<LengthRow[]>(() => [
  {
    key: 'textDecorationThickness',
    label: typography.value.decorationThickness,
    modeLabel: typography.value.decorationThicknessMode,
    value: thickness,
    automatic: automatic.value.thickness,
    popup: thicknessPopup
  },
  {
    key: 'textUnderlineOffset',
    label: typography.value.decorationOffset,
    modeLabel: typography.value.decorationOffsetMode,
    value: offset,
    automatic: automatic.value.offset,
    popup: offsetPopup
  }
])
const color = computed(() => fills?.find((fill) => fill.visible && fill.type === 'SOLID'))
/** The text's own colour, which a decoration given a colour of its own starts from. */
const textColor = computed<Color>(() => {
  const fill = node.fills.find((paint) => paint.visible && paint.type === 'SOLID')
  return fill ? { ...fill.color, a: fill.opacity } : BLACK
})

/** Rounded as the fields show lengths, so a fixed value starts where the automatic one was. */
function rounded(value: number): number {
  return Math.round(value * 100) / 100
}

/** A change made at once, as one undo step. */
function change(key: DecorationKey, value: number | null | Fill[]) {
  emit('update', key, value)
  emit('commit', key)
}

/** Whether a length is automatic or fixed, or neither where the selected texts differ. */
function modeOf(value: MixedValue<number | null>): 'AUTO' | 'FIXED' | undefined {
  if (value === MIXED) return undefined
  return value === null ? 'AUTO' : 'FIXED'
}

function setMode(key: LengthKey, mode: string, automaticValue: number) {
  change(key, mode === 'AUTO' ? null : rounded(automaticValue))
}

function solid(next: Color): Fill {
  const base = color.value
  return base
    ? { ...base, color: { ...next, a: 1 }, opacity: next.a }
    : { type: 'SOLID', color: { ...next, a: 1 }, opacity: next.a, visible: true }
}
</script>

<template>
  <div class="mb-3 grid gap-1.5" data-property="decoration-settings">
    <template v-if="underline">
      <PanelFieldGroup :label="typography.decorationStyle">
        <AppSelect
          :label="typography.decorationStyle"
          :model-value="decorationStyle"
          :placeholder="panels.mixed"
          :options="styleOptions"
          data-property="decoration-style"
          @update:model-value="emit('style', $event as TextDecorationStyle)"
        />
      </PanelFieldGroup>

      <PanelGrid :columns="2">
        <PanelFieldGroup v-for="length in lengths" :key="length.key" :label="length.label">
          <NumberField
            :model-value="length.value ?? rounded(length.automatic)"
            :placeholder="panels.mixed"
            :aria-label="length.label"
            :min="length.key === 'textDecorationThickness' ? 0 : -1000"
            :step="0.5"
            suffix="px"
            :data-property="length.key"
            @update:model-value="emit('update', length.key, $event)"
            @commit="emit('commit', length.key)"
            @cancel="emit('cancel', length.key)"
          >
            <template v-if="length.value === null" #display
              ><span class="min-w-0 flex-1 truncate text-surface">{{ panels.auto }}</span></template
            >
            <template #suffix>
              <AppSelectRoot
                v-model:open="length.popup.open.value"
                :model-value="modeOf(length.value)"
                @update:model-value="setMode(length.key, String($event), length.automatic)"
              >
                <SelectFieldTrigger :label="length.modeLabel" />
                <AppSelectContent v-if="length.popup.portalActive.value" align="end">
                  <AppSelectItem value="AUTO">{{ panels.auto }}</AppSelectItem>
                  <AppSelectItem value="FIXED">{{ panels.sizingFixed }}</AppSelectItem>
                </AppSelectContent>
              </AppSelectRoot>
            </template>
          </NumberField>
        </PanelFieldGroup>
      </PanelGrid>

      <label class="flex items-center justify-between gap-1.5 text-2xs text-muted">
        <span>{{ typography.skipInk }}</span>
        <AppSwitch
          :model-value="skipInk === true"
          :label="typography.skipInk"
          data-property="decoration-skip-ink"
          @update:model-value="emit('skipInk', $event)"
        />
      </label>
    </template>

    <PanelFieldGroup :label="typography.decorationColor" :ui="{ container: 'flex-row gap-1.5' }">
      <PaintField v-if="color" class="min-w-0 flex-1" data-property="decoration-color">
        <template #preview>
          <ColorPicker
            :color="{ ...color.color, a: color.opacity }"
            @update="emit('update', 'textDecorationFills', [solid($event)])"
            @commit="emit('commit', 'textDecorationFills')"
            @cancel="emit('cancel', 'textDecorationFills')"
          />
        </template>
        <template #value>
          <PaintValue
            :color="color.color"
            :label="typography.decorationColor"
            @update="change('textDecorationFills', [solid({ ...$event, a: color.opacity })])"
          />
        </template>
      </PaintField>
      <span
        v-else
        :class="[
          panelFieldBase,
          'flex min-w-0 flex-1 items-center truncate px-2 text-2xs text-muted'
        ]"
        >{{ typography.decorationTextColor }}</span
      >
      <IconButton
        v-if="color"
        :label="typography.removeDecorationColor"
        @click="change('textDecorationFills', [])"
      >
        <icon-lucide-minus class="size-3.5" />
      </IconButton>
      <IconButton
        v-else
        :label="typography.addDecorationColor"
        @click="change('textDecorationFills', [solid(textColor)])"
      >
        <icon-lucide-plus class="size-3.5" />
      </IconButton>
    </PanelFieldGroup>
  </div>
</template>
