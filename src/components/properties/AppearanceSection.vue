<script setup lang="ts">
import ScrubInput from '@/components/ScrubInput.vue'
import Tip from '@/components/Tip.vue'
import { sectionWrapper } from '@/components/ui/section'
import { useAppearance } from '@open-pencil/vue'

const {
  node,
  isMulti,
  active,
  hasCornerRadius,
  independentCorners,
  cornerRadiusValue,
  opacityPercent,
  visibilityState,
  updateProp,
  commitProp,
  toggleVisibility,
  toggleIndependentCorners,
  updateCornerProp,
  commitCornerProp
} = useAppearance()
</script>

<template>
  <div v-if="active" data-test-id="appearance-section" :class="sectionWrapper()">
    <div class="mb-1.5 flex items-center justify-between">
      <label class="text-[11px] text-muted">Appearance</label>
      <Tip label="Toggle visibility">
        <button
          data-test-id="appearance-visibility"
          class="flex cursor-pointer items-center justify-center rounded border-none bg-transparent p-0.5 text-muted hover:bg-hover hover:text-surface"
          :class="{ 'text-accent': visibilityState === 'hidden' }"
          @click="toggleVisibility"
        >
          <icon-lucide-eye v-if="visibilityState === 'visible'" class="size-3.5" />
          <icon-lucide-eye-off v-else-if="visibilityState === 'hidden'" class="size-3.5" />
          <icon-lucide-eye class="size-3.5 opacity-50" v-else />
        </button>
      </Tip>
    </div>
    <div class="flex gap-1.5">
      <ScrubInput
        suffix="%"
        :model-value="opacityPercent"
        :min="0"
        :max="100"
        @update:model-value="updateProp('opacity', $event / 100)"
        @commit="(v: number, p: number) => commitProp('opacity', v / 100, p / 100)"
      >
        <template #icon>
          <icon-lucide-blend class="size-3" />
        </template>
      </ScrubInput>
      <template v-if="hasCornerRadius">
        <ScrubInput
          v-if="independentCorners !== true"
          data-test-id="corner-radius-input"
          :model-value="cornerRadiusValue"
          :min="0"
          @update:model-value="updateProp('cornerRadius', $event)"
          @commit="(v: number, p: number) => commitProp('cornerRadius', v, p)"
        >
          <template #icon>
            <icon-lucide-radius class="size-3" />
          </template>
        </ScrubInput>
        <Tip label="Independent corner radii">
          <button
            data-test-id="independent-corners-toggle"
            class="flex size-[26px] shrink-0 cursor-pointer items-center justify-center rounded border border-border bg-input text-muted hover:bg-hover hover:text-surface"
            :class="{ '!border-accent !text-accent': independentCorners === true }"
            @click="toggleIndependentCorners"
          >
            <svg
              class="size-3"
              viewBox="0 0 12 12"
              fill="none"
              stroke="currentColor"
              stroke-width="1.5"
            >
              <path d="M1 4V2.5A1.5 1.5 0 0 1 2.5 1H4" />
              <path d="M8 1h1.5A2.5 2.5 0 0 1 11 3.5V5" />
              <path d="M11 8v1a2 2 0 0 1-2 2H8" />
              <path d="M4 11H3a2 2 0 0 1-2-2V8" />
            </svg>
          </button>
        </Tip>
      </template>
    </div>

    <div
      v-if="hasCornerRadius && independentCorners === true && !isMulti"
      class="mt-1.5 grid grid-cols-2 gap-1.5"
    >
      <ScrubInput
        data-test-id="corner-tl-input"
        :model-value="node!.topLeftRadius"
        :min="0"
        @update:model-value="updateCornerProp('topLeftRadius', $event)"
        @commit="(v: number, p: number) => commitCornerProp('topLeftRadius', v, p)"
      >
        <template #icon>
          <svg
            class="size-3"
            viewBox="0 0 12 12"
            fill="none"
            stroke="currentColor"
            stroke-width="1.5"
          >
            <path d="M1 11V4a3 3 0 0 1 3-3h7" />
          </svg>
        </template>
      </ScrubInput>
      <ScrubInput
        data-test-id="corner-tr-input"
        :model-value="node!.topRightRadius"
        :min="0"
        @update:model-value="updateCornerProp('topRightRadius', $event)"
        @commit="(v: number, p: number) => commitCornerProp('topRightRadius', v, p)"
      >
        <template #icon>
          <svg
            class="size-3"
            viewBox="0 0 12 12"
            fill="none"
            stroke="currentColor"
            stroke-width="1.5"
          >
            <path d="M11 11V4a3 3 0 0 0-3-3H1" />
          </svg>
        </template>
      </ScrubInput>
      <ScrubInput
        data-test-id="corner-bl-input"
        :model-value="node!.bottomLeftRadius"
        :min="0"
        @update:model-value="updateCornerProp('bottomLeftRadius', $event)"
        @commit="(v: number, p: number) => commitCornerProp('bottomLeftRadius', v, p)"
      >
        <template #icon>
          <svg
            class="size-3"
            viewBox="0 0 12 12"
            fill="none"
            stroke="currentColor"
            stroke-width="1.5"
          >
            <path d="M1 1v7a3 3 0 0 0 3 3h7" />
          </svg>
        </template>
      </ScrubInput>
      <ScrubInput
        data-test-id="corner-br-input"
        :model-value="node!.bottomRightRadius"
        :min="0"
        @update:model-value="updateCornerProp('bottomRightRadius', $event)"
        @commit="(v: number, p: number) => commitCornerProp('bottomRightRadius', v, p)"
      >
        <template #icon>
          <svg
            class="size-3"
            viewBox="0 0 12 12"
            fill="none"
            stroke="currentColor"
            stroke-width="1.5"
          >
            <path d="M11 1v7a3 3 0 0 1-3 3H1" />
          </svg>
        </template>
      </ScrubInput>
    </div>
  </div>
</template>
