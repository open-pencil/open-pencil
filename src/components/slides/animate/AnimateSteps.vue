<script setup lang="ts">
import { tv } from 'tailwind-variants'
import { computed, ref, watch, type ComponentPublicInstance } from 'vue'

import { layerAnimationDirection, type LayerAnimation } from '@open-pencil/scene-graph/slides'
import { useMessages } from '@open-pencil/vue/i18n'
import { useFlatReorderDrag } from '@open-pencil/vue/shared/drag'

import { useEditorStore } from '@/app/editor/active-store'
import IconButton from '@/components/ui/button/IconButton.vue'
import LeftToRight from '@/components/ui/direction/LeftToRight.vue'
import Tip from '@/components/ui/overlay/Tip.vue'
import { fillSwatchTrigger } from '@/components/ui/paint/swatch-trigger'
import PanelItemRow from '@/components/ui/panel/PanelItemRow.vue'
import PanelSection from '@/components/ui/panel/PanelSection.vue'
import animateTheme from '@/theme/slides/animate'

import AnimateStepSettings from './AnimateStepSettings.vue'

export interface AnimatedStep {
  id: string
  name: string
  animation: LayerAnimation
}

/**
 * A slide's build as the Effects section lists effects: a row per animated layer in the order
 * they play, dragged to reorder, each opening its settings under it.
 */
const { slideId, steps, addable } = defineProps<{
  slideId: string
  steps: readonly AnimatedStep[]
  /** Selected layers on the slide that can animate and do not yet. */
  addable: readonly string[]
}>()

const store = useEditorStore()
const messages = useMessages('slides')
const ui = tv(animateTheme)()
const previewButton = fillSwatchTrigger({ size: 'md', framed: true }).root()

/** Whether this slide's build is playing on the canvas. */
const playing = computed(() => store.state.buildPreview?.slideId === slideId)

/** The step whose settings show; selecting an animated layer on the canvas opens its step. */
const expandedId = ref<string | null>(null)
const selectedId = computed(() => {
  const [only, ...rest] = store.state.selectedIds
  return rest.length === 0 ? only : undefined
})
watch(selectedId, (id) => {
  if (id && steps.some((step) => step.id === id)) expandedId.value = id
})
function toggle(id: string) {
  expandedId.value = expandedId.value === id ? null : id
}

const reorder = useFlatReorderDrag({
  items: () => steps,
  onMove: (id, index) => store.moveLayerAnimation(id, index)
})
function setupRow(element: Element | ComponentPublicInstance | null, id: string) {
  reorder.setupItem(element instanceof HTMLElement ? element : null, () => ({ id }))
}
function dropPosition(id: string) {
  if (reorder.instructionTargetId.value !== id) return undefined
  return reorder.instruction.value?.operation === 'reorder-before' ? 'before' : 'after'
}
</script>

<template>
  <PanelSection :label="messages.animations" data-test-id="animate-animations">
    <template #actions>
      <IconButton
        v-if="playing"
        :label="messages.stopAnimations"
        data-test-id="animate-stop"
        @click="store.stopBuildPreview()"
      >
        <icon-lucide-square class="size-3.5" />
      </IconButton>
      <IconButton
        v-else
        :label="messages.playAnimations"
        :disabled="steps.length === 0"
        data-test-id="animate-play"
        @click="store.previewBuild(slideId)"
      >
        <icon-lucide-play class="size-3.5" />
      </IconButton>
      <IconButton
        :label="messages.addAnimation"
        :disabled="addable.length === 0"
        data-test-id="animate-add-animation"
        @click="store.addLayerAnimations(addable)"
      >
        <icon-lucide-plus class="size-3.5" />
      </IconButton>
    </template>
    <p v-if="steps.length === 0" :class="ui.empty()">{{ messages.noAnimations }}</p>
    <ol v-else :class="ui.steps()">
      <li
        v-for="(step, index) in steps"
        :key="step.id"
        :ref="(element) => setupRow(element, step.id)"
        :class="ui.step()"
        :data-dragging="reorder.draggingId.value === step.id || undefined"
        :data-selected="selectedId === step.id || undefined"
        :data-playing="store.state.buildPreview?.animatingId === step.id || undefined"
        data-test-id="animate-step"
      >
        <div
          v-if="dropPosition(step.id)"
          :class="[ui.drop(), dropPosition(step.id) === 'before' ? 'top-0' : 'bottom-0']"
        />
        <PanelItemRow>
          <Tip
            :label="
              expandedId === step.id
                ? messages.hideAnimationSettings
                : messages.showAnimationSettings
            "
          >
            <button
              type="button"
              :class="previewButton"
              :aria-expanded="expandedId === step.id"
              :aria-label="
                expandedId === step.id
                  ? messages.hideAnimationSettings
                  : messages.showAnimationSettings
              "
              data-property="animate-step-expand"
              @click="toggle(step.id)"
            >
              <LeftToRight v-if="layerAnimationDirection(step.animation.style)">
                <icon-lucide-arrow-right
                  v-if="layerAnimationDirection(step.animation.style) === 'RIGHT'"
                  data-direction="physical"
                  :class="ui.styleIcon()"
                />
                <icon-lucide-arrow-left
                  v-else-if="layerAnimationDirection(step.animation.style) === 'LEFT'"
                  data-direction="physical"
                  :class="ui.styleIcon()"
                />
                <icon-lucide-arrow-up
                  v-else-if="layerAnimationDirection(step.animation.style) === 'UP'"
                  :class="ui.styleIcon()"
                />
                <icon-lucide-arrow-down v-else :class="ui.styleIcon()" />
              </LeftToRight>
              <icon-lucide-blend v-else :class="ui.styleIcon()" />
            </button>
          </Tip>
          <button
            type="button"
            :class="ui.stepLabel()"
            data-property="animate-step-select"
            @click="store.select([step.id])"
          >
            <span :class="ui.stepNumber()">{{ index + 1 }}</span>
            <span :class="ui.stepName()">{{ step.name }}</span>
            <span v-if="step.animation.phase === 'OUT'" :class="ui.stepSummary()">
              · {{ messages.phaseOut }}
            </span>
          </button>
          <template #rail="{ removeClass }">
            <!-- Plays with the step before it: the chain keeps to the rail, so rows line up. -->
            <Tip v-if="step.animation.trigger === 'AFTER_PREVIOUS'" :label="messages.afterPrevious">
              <span :class="ui.chain()" role="img" :aria-label="messages.afterPrevious">
                <icon-lucide-link-2 class="size-3" />
              </span>
            </Tip>
            <Tip :label="messages.removeAnimation">
              <button
                type="button"
                :class="[removeClass, ui.remove()]"
                :aria-label="messages.removeAnimation"
                data-test-id="animate-remove-animation"
                @click="store.removeLayerAnimations([step.id])"
              >
                <icon-lucide-minus class="size-3.5" />
              </button>
            </Tip>
          </template>
          <template v-if="expandedId === step.id" #details>
            <AnimateStepSettings :layer-id="step.id" :animation="step.animation" />
          </template>
        </PanelItemRow>
      </li>
    </ol>
  </PanelSection>
</template>
