<script setup lang="ts">
import { computed, ref } from 'vue'

import {
  SLIDE_SIZE_PRESETS,
  slideRows,
  type SlideSizePreset
} from '@open-pencil/scene-graph/slides'
import { MIXED } from '@open-pencil/vue/controls/node-props'
import { useMessages } from '@open-pencil/vue/i18n'
import { useSceneComputed } from '@open-pencil/vue/internal/scene-computed'

import { useEditorStore } from '@/app/editor/active-store'
import NumberField from '@/components/inputs/NumberField.vue'
import Tip from '@/components/ui/overlay/Tip.vue'
import PanelGrid from '@/components/ui/panel/PanelGrid.vue'
import PanelSection from '@/components/ui/panel/PanelSection.vue'
import AppSelect from '@/components/ui/select/AppSelect.vue'
import AppSwitch from '@/components/ui/toggle/AppSwitch.vue'

/**
 * The size of a deck's slides: a shape from the presets or any width and height. A new size
 * scales what is on the slides to fit, or keeps it where its constraints put it.
 */
const store = useEditorStore()
const messages = useMessages('slides')
const panels = useMessages('panels')
const scaleContent = ref(true)

const slides = useSceneComputed(() => slideRows(store.graph, store.state.currentPageId).flat())
/** The deck's size, or MIXED on an axis where its slides differ. */
const size = computed(() => {
  const [first, ...rest] = slides.value
  if (!first) return null
  return {
    width: rest.every((slide) => slide.width === first.width) ? first.width : MIXED,
    height: rest.every((slide) => slide.height === first.height) ? first.height : MIXED
  }
})

const presetLabels = computed<Record<SlideSizePreset['id'], string>>(() => ({
  wide: messages.value.sizeWide,
  standard: messages.value.sizeStandard,
  square: messages.value.sizeSquare,
  portrait: messages.value.sizePortrait
}))
const options = computed(() =>
  SLIDE_SIZE_PRESETS.map((preset) => ({
    value: preset.id,
    label: `${presetLabels.value[preset.id]} · ${preset.width}×${preset.height}`
  }))
)

function resize(width: number, height: number) {
  store.setSlideSize(
    slides.value.map((slide) => slide.id),
    { width, height },
    scaleContent.value ? 'scale' : 'constraints'
  )
}

const presetId = computed({
  get: () =>
    SLIDE_SIZE_PRESETS.find(
      (preset) => preset.width === size.value?.width && preset.height === size.value.height
    )?.id ?? 'custom',
  set: (id: string) => {
    const preset = SLIDE_SIZE_PRESETS.find((candidate) => candidate.id === id)
    if (preset) resize(preset.width, preset.height)
  }
})

/** A typed width or height, with the other axis as the first slide has it. */
function setAxis(axis: 'width' | 'height', value: number) {
  const first = slides.value.at(0)
  if (!first) return
  resize(axis === 'width' ? value : first.width, axis === 'height' ? value : first.height)
}
</script>

<template>
  <PanelSection v-if="size" :label="messages.slideSize" data-test-id="slide-size">
    <AppSelect
      v-model="presetId"
      data-property="slide-size-preset"
      :label="messages.slideSize"
      :options="options"
      :placeholder="messages.sizeCustom"
    />
    <PanelGrid :columns="2" class="mt-2">
      <Tip :label="panels.width">
        <NumberField
          icon="W"
          data-property="slide-width"
          :aria-label="panels.width"
          :model-value="size.width"
          :min="1"
          @commit="(value: number) => setAxis('width', value)"
        />
      </Tip>
      <Tip :label="panels.height">
        <NumberField
          icon="H"
          data-property="slide-height"
          :aria-label="panels.height"
          :model-value="size.height"
          :min="1"
          @commit="(value: number) => setAxis('height', value)"
        />
      </Tip>
    </PanelGrid>
    <div class="mt-2 flex items-center justify-between gap-2 text-xs text-surface">
      <span>{{ messages.scaleContent }}</span>
      <AppSwitch
        v-model="scaleContent"
        data-property="slide-scale-content"
        :label="messages.scaleContent"
      />
    </div>
  </PanelSection>
</template>
