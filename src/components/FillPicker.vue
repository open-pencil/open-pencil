<script setup lang="ts">
import { ref, computed } from 'vue'
import {
  PopoverRoot,
  PopoverTrigger,
  PopoverPortal,
  PopoverContent,
  SelectRoot,
  SelectTrigger,
  SelectValue,
  SelectPortal,
  SelectContent,
  SelectItem,
  SelectItemText,
  SelectItemIndicator,
  SelectViewport
} from 'reka-ui'

import HsvColorArea from './HsvColorArea.vue'
import ScrubInput from './ScrubInput.vue'
import { colorToCSS, colorToHexRaw, parseColor } from '@open-pencil/core'

import type { Color, Fill, GradientStop, GradientTransform } from '@open-pencil/core'

type FillCategory = 'SOLID' | 'GRADIENT' | 'IMAGE'
type GradientSubtype =
  | 'GRADIENT_LINEAR'
  | 'GRADIENT_RADIAL'
  | 'GRADIENT_ANGULAR'
  | 'GRADIENT_DIAMOND'

const GRADIENT_SUBTYPES: { type: GradientSubtype; label: string }[] = [
  { type: 'GRADIENT_LINEAR', label: 'Linear' },
  { type: 'GRADIENT_RADIAL', label: 'Radial' },
  { type: 'GRADIENT_ANGULAR', label: 'Angular' },
  { type: 'GRADIENT_DIAMOND', label: 'Diamond' }
]

const DEFAULT_GRADIENT_TRANSFORMS: Record<GradientSubtype, GradientTransform> = {
  GRADIENT_LINEAR: { m00: 1, m01: 0, m02: 0, m10: 0, m11: 0, m12: 0.5 },
  GRADIENT_RADIAL: { m00: 0.5, m01: 0, m02: 0.5, m10: 0, m11: 0.5, m12: 0.5 },
  GRADIENT_ANGULAR: { m00: 0.5, m01: 0, m02: 0.5, m10: 0, m11: 0.5, m12: 0.5 },
  GRADIENT_DIAMOND: { m00: 0.5, m01: 0, m02: 0.5, m10: 0, m11: 0.5, m12: 0.5 }
}

const { fill } = defineProps<{
  fill: Fill
}>()

const emit = defineEmits<{
  update: [fill: Fill]
}>()

const activeStopIndex = ref(0)

const fillCategory = computed<FillCategory>(() => {
  if (fill.type.startsWith('GRADIENT')) return 'GRADIENT'
  if (fill.type === 'IMAGE') return 'IMAGE'
  return 'SOLID'
})

const isGradient = computed(() => fillCategory.value === 'GRADIENT')

const gradientSubtype = computed(() =>
  isGradient.value ? (fill.type as GradientSubtype) : 'GRADIENT_LINEAR'
)

const activeColor = computed(() => {
  if (isGradient.value && fill.gradientStops?.length) {
    const idx = Math.min(activeStopIndex.value, fill.gradientStops.length - 1)
    return fill.gradientStops[idx].color
  }
  return fill.color
})

function onColorUpdate(color: Color) {
  if (isGradient.value && fill.gradientStops?.length) {
    const stops = [...fill.gradientStops]
    const idx = Math.min(activeStopIndex.value, stops.length - 1)
    stops[idx] = { ...stops[idx], color }
    emit('update', { ...fill, gradientStops: stops })
  } else {
    emit('update', { ...fill, color })
  }
}

function setCategory(cat: FillCategory) {
  if (cat === fillCategory.value) return
  if (cat === 'SOLID') {
    const color = fill.gradientStops?.length
      ? { ...fill.gradientStops[0].color }
      : fill.color
    emit('update', { ...fill, type: 'SOLID', color })
  } else if (cat === 'GRADIENT') {
    const type: GradientSubtype = 'GRADIENT_LINEAR'
    const stops = fill.gradientStops?.length
      ? fill.gradientStops
      : [
          { color: { ...fill.color }, position: 0 },
          { color: { r: 1, g: 1, b: 1, a: 1 }, position: 1 }
        ]
    emit('update', {
      ...fill,
      type,
      gradientStops: stops,
      gradientTransform: DEFAULT_GRADIENT_TRANSFORMS[type]
    })
    activeStopIndex.value = 0
  } else {
    emit('update', { ...fill, type: 'IMAGE' })
  }
}

function setGradientSubtype(type: string) {
  const subtype = type as GradientSubtype
  if (subtype === fill.type) return
  emit('update', {
    ...fill,
    type: subtype,
    gradientTransform: DEFAULT_GRADIENT_TRANSFORMS[subtype]
  })
}

function selectStop(index: number) {
  activeStopIndex.value = index
}

function addStop() {
  if (!fill.gradientStops) return
  const stops = [...fill.gradientStops]
  const newPos =
    stops.length >= 2
      ? (stops[stops.length - 2].position + stops[stops.length - 1].position) / 2
      : 0.5
  stops.push({ color: { ...activeColor.value }, position: newPos })
  stops.sort((a, b) => a.position - b.position)
  const newIndex = stops.findIndex((s) => s.position === newPos)
  activeStopIndex.value = newIndex
  emit('update', { ...fill, gradientStops: stops })
}

function removeStop(index: number) {
  if (!fill.gradientStops || fill.gradientStops.length <= 2) return
  const stops = fill.gradientStops.filter((_, i) => i !== index)
  activeStopIndex.value = Math.min(activeStopIndex.value, stops.length - 1)
  emit('update', { ...fill, gradientStops: stops })
}

function updateStopPosition(index: number, value: string) {
  if (!fill.gradientStops) return
  const pos = Math.max(0, Math.min(100, Number(value))) / 100
  const stops = [...fill.gradientStops]
  stops[index] = { ...stops[index], position: pos }
  emit('update', { ...fill, gradientStops: stops })
}

function updateStopColor(index: number, hex: string) {
  if (!fill.gradientStops) return
  const color = parseColor(hex.startsWith('#') ? hex : `#${hex}`)
  if (!color) return
  const stops = [...fill.gradientStops]
  stops[index] = { ...stops[index], color: { ...color, a: stops[index].color.a } }
  emit('update', { ...fill, gradientStops: stops })
}

function updateStopOpacity(index: number, value: string) {
  if (!fill.gradientStops) return
  const a = Math.max(0, Math.min(100, Number(value))) / 100
  const stops = [...fill.gradientStops]
  stops[index] = { ...stops[index], color: { ...stops[index].color, a } }
  emit('update', { ...fill, gradientStops: stops })
}

function gradientStops(stops: GradientStop[]): string {
  return stops.map((s) => `${colorToCSS(s.color)} ${s.position * 100}%`).join(', ')
}

const swatchBackground = computed(() => {
  if (isGradient.value && fill.gradientStops?.length) {
    return `linear-gradient(to right, ${gradientStops(fill.gradientStops)})`
  }
  return colorToCSS(fill.color)
})

const gradientBarBackground = computed(() => {
  if (!fill.gradientStops?.length) return ''
  return `linear-gradient(to right, ${gradientStops(fill.gradientStops)})`
})

const gradientStopBarRef = ref<HTMLDivElement | null>(null)
const draggingStopIndex = ref<number | null>(null)

function onStopPointerDown(index: number, e: PointerEvent) {
  selectStop(index)
  draggingStopIndex.value = index
  const el = gradientStopBarRef.value
  if (el) el.setPointerCapture(e.pointerId)
}

function onStopBarPointerMove(e: PointerEvent) {
  const el = gradientStopBarRef.value
  if (!el || draggingStopIndex.value === null || !el.hasPointerCapture(e.pointerId)) return
  const rect = el.getBoundingClientRect()
  const pos = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
  const stops = [...(fill.gradientStops ?? [])]
  stops[draggingStopIndex.value] = { ...stops[draggingStopIndex.value], position: pos }
  emit('update', { ...fill, gradientStops: stops })
}

function onStopBarPointerUp() {
  draggingStopIndex.value = null
}

function stopSwatchColor(stop: GradientStop) {
  return colorToCSS(stop.color)
}
</script>

<template>
  <PopoverRoot>
    <PopoverTrigger as-child>
      <button
        data-test-id="fill-picker-swatch"
        class="size-5 shrink-0 cursor-pointer rounded border border-border p-0"
        :style="{ background: swatchBackground }"
      />
    </PopoverTrigger>

    <PopoverPortal>
      <PopoverContent
        class="z-[100] w-60 rounded-lg border border-border bg-panel p-2 shadow-xl"
        :side-offset="4"
        side="left"
      >
        <!-- Fill category tabs: Solid | Gradient | Image -->
        <div class="mb-2 flex items-center gap-0.5">
          <button
            class="flex size-6 cursor-pointer items-center justify-center rounded border-none p-0 text-muted transition-colors hover:bg-hover hover:text-surface"
            :class="{ 'bg-hover text-surface': fillCategory === 'SOLID' }"
            data-test-id="fill-picker-tab-solid"
            title="Solid"
            @click="setCategory('SOLID')"
          >
            <svg class="size-3.5" viewBox="0 0 16 16">
              <rect x="2" y="2" width="12" height="12" rx="2" fill="currentColor" />
            </svg>
          </button>
          <button
            class="flex size-6 cursor-pointer items-center justify-center rounded border-none p-0 text-muted transition-colors hover:bg-hover hover:text-surface"
            :class="{ 'bg-hover text-surface': fillCategory === 'GRADIENT' }"
            data-test-id="fill-picker-tab-gradient"
            title="Gradient"
            @click="setCategory('GRADIENT')"
          >
            <svg class="size-3.5" viewBox="0 0 16 16">
              <defs>
                <linearGradient id="gl">
                  <stop offset="0" stop-color="currentColor" />
                  <stop offset="1" stop-color="currentColor" stop-opacity="0" />
                </linearGradient>
              </defs>
              <rect x="2" y="2" width="12" height="12" rx="2" fill="url(#gl)" />
            </svg>
          </button>
          <button
            class="flex size-6 cursor-pointer items-center justify-center rounded border-none p-0 text-muted transition-colors hover:bg-hover hover:text-surface"
            :class="{ 'bg-hover text-surface': fillCategory === 'IMAGE' }"
            data-test-id="fill-picker-tab-image"
            title="Image"
            @click="setCategory('IMAGE')"
          >
            <icon-lucide-image class="size-3.5" />
          </button>
        </div>

        <!-- Gradient subtype dropdown -->
        <div v-if="isGradient" class="mb-2">
          <SelectRoot :model-value="gradientSubtype" @update:model-value="setGradientSubtype">
            <SelectTrigger
              class="flex h-7 w-28 cursor-pointer items-center justify-between rounded border border-border bg-input px-2 text-xs text-surface"
            >
              <SelectValue />
              <icon-lucide-chevron-down class="size-3 text-muted" />
            </SelectTrigger>
            <SelectPortal>
              <SelectContent
                class="z-[200] min-w-[112px] rounded-md border border-border bg-panel py-1 shadow-xl"
                position="popper"
                side="bottom"
                :side-offset="4"
                :align="'start'"
              >
                <SelectViewport>
                  <SelectItem
                    v-for="sub in GRADIENT_SUBTYPES"
                    :key="sub.type"
                    :value="sub.type"
                    class="relative flex cursor-pointer items-center rounded py-1 pr-2 pl-6 text-xs text-surface outline-none data-[highlighted]:bg-accent data-[highlighted]:text-white"
                  >
                    <SelectItemIndicator class="absolute left-1.5">
                      <icon-lucide-check class="size-3" />
                    </SelectItemIndicator>
                    <SelectItemText>{{ sub.label }}</SelectItemText>
                  </SelectItem>
                </SelectViewport>
              </SelectContent>
            </SelectPortal>
          </SelectRoot>
        </div>

        <!-- Gradient stop bar -->
        <div
          v-if="isGradient && fill.gradientStops?.length"
          ref="gradientStopBarRef"
          data-test-id="fill-picker-gradient-bar"
          class="relative mb-2 h-6 rounded"
          :style="{ background: gradientBarBackground }"
          @pointermove="onStopBarPointerMove"
          @pointerup="onStopBarPointerUp"
        >
          <div
            v-for="(stop, idx) in fill.gradientStops"
            :key="idx"
            class="absolute top-1/2 size-3.5 -translate-x-1/2 -translate-y-1/2 cursor-grab rounded-sm border-2 shadow-sm"
            :class="idx === activeStopIndex ? 'border-white' : 'border-white/60'"
            :style="{
              left: `${stop.position * 100}%`,
              background: stopSwatchColor(stop)
            }"
            @pointerdown.stop="onStopPointerDown(idx, $event)"
          />
        </div>

        <!-- Gradient stops list -->
        <div v-if="isGradient && fill.gradientStops?.length" class="mb-2">
          <div class="mb-1 flex items-center justify-between">
            <span class="text-[11px] text-muted">Stops</span>
            <button
              class="flex size-4 cursor-pointer items-center justify-center rounded border-none bg-transparent p-0 text-muted hover:text-surface"
              data-test-id="fill-picker-add-stop"
              title="Add stop"
              @click="addStop"
            >
              <icon-lucide-plus class="size-3" />
            </button>
          </div>
          <div
            v-for="(stop, idx) in fill.gradientStops"
            :key="idx"
            class="flex items-center gap-1 py-0.5"
            :class="{ 'rounded bg-hover/50': idx === activeStopIndex }"
            @click="selectStop(idx)"
          >
            <ScrubInput
              class="w-11"
              suffix="%"
              :model-value="Math.round(stop.position * 100)"
              :min="0"
              :max="100"
              @update:model-value="updateStopPosition(idx, String($event))"
              @click.stop
            />
            <button
              class="size-4 shrink-0 cursor-pointer rounded border border-border p-0"
              :style="{ background: stopSwatchColor(stop) }"
              @click.stop="selectStop(idx)"
            />
            <input
              class="min-w-0 flex-1 rounded border border-border bg-input px-1 py-0.5 font-mono text-[11px] text-surface"
              :value="colorToHexRaw(stop.color)"
              maxlength="6"
              @change="updateStopColor(idx, ($event.target as HTMLInputElement).value)"
              @click.stop
            />
            <ScrubInput
              class="w-9"
              suffix="%"
              :model-value="Math.round(stop.color.a * 100)"
              :min="0"
              :max="100"
              @update:model-value="updateStopOpacity(idx, String($event))"
              @click.stop
            />
            <button
              v-if="(fill.gradientStops?.length ?? 0) > 2"
              class="flex size-4 cursor-pointer items-center justify-center rounded border-none bg-transparent p-0 text-muted hover:text-surface"
              @click.stop="removeStop(idx)"
            >
              −
            </button>
          </div>
        </div>

        <!-- Image placeholder -->
        <div
          v-if="fill.type === 'IMAGE'"
          data-test-id="fill-picker-image-placeholder"
          class="flex h-24 items-center justify-center rounded border border-dashed border-border text-xs text-muted"
        >
          Image fill (coming soon)
        </div>

        <!-- HSV color area (solid mode, or editing active gradient stop) -->
        <HsvColorArea v-if="fill.type !== 'IMAGE'" :color="activeColor" @update="onColorUpdate" />
      </PopoverContent>
    </PopoverPortal>
  </PopoverRoot>
</template>
