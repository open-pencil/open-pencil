<script setup lang="ts">
import { tv } from 'tailwind-variants'
import { computed, ref, watch } from 'vue'

import type { CubicBezier, Easing, EasingCurve, Spring } from '@open-pencil/scene-graph'
import { parseCSSEasing } from '@open-pencil/scene-graph/css'
import {
  easingBezier,
  easingForBezier,
  easingPreset,
  easingSpring,
  isSpringCurve,
  springBounce,
  springWithBounce
} from '@open-pencil/scene-graph/variables'
import { useMessages } from '@open-pencil/vue/i18n'

import NumberField from '@/components/inputs/NumberField.vue'
import IconButton from '@/components/ui/button/IconButton.vue'
import AppInput from '@/components/ui/input/AppInput.vue'
import AppSelect from '@/components/ui/select/AppSelect.vue'
import SegmentedControl from '@/components/ui/select/SegmentedControl.vue'
import theme from '@/theme/variables/easing'

import EasingGraph from './EasingGraph.vue'
import { listedCurve, presetsFor } from './presets'
import { easingThumbnail } from './thumbnail'

/**
 * Figma's easing editor: a preset, the curve or spring it is, and its graph; then a curve's four
 * numbers, or a spring's bounce, or its stiffness, damping and mass where it is edited by its
 * physics. Any edit of a preset's numbers makes it a custom curve or spring.
 */
const { easing } = defineProps<{ easing: Easing }>()
const emit = defineEmits<{ update: [easing: Easing, gesture?: string]; close: [] }>()

const text = useMessages('variables/easing')
const ui = tv(theme)()

/** The curve a curve starts as when the spring tab is left, as Figma's editor starts it. */
const FIRST_CURVE: CubicBezier = { x1: 0, y1: 0, x2: 0.58, y2: 1 }

const isSpring = computed(() => isSpringCurve(easing.easing))
const spring = computed(() => easingSpring(easing))
const bezier = computed(() => easingBezier(easing))

const presetOptions = computed(() =>
  presetsFor(easing).map(({ curve, message }) => ({ value: curve, label: text.value[message] }))
)
const preset = computed({
  get: () => listedCurve(easing),
  set: (curve: EasingCurve) => emit('update', chosen(curve))
})

/** A preset with its own numbers; a custom curve or spring starts from the one shown. */
function chosen(curve: EasingCurve): Easing {
  if (curve === 'CUSTOM_CUBIC')
    return { easing: curve, bezier: { ...(bezier.value ?? FIRST_CURVE) } }
  if (curve === 'CUSTOM_SPRING')
    return { easing: curve, spring: { ...(spring.value ?? springWithBounce(0)) } }
  return easingPreset(curve)
}

function thumbnail(curve: EasingCurve) {
  return easingThumbnail(curve === listedCurve(easing) ? easing : easingPreset(curve))
}

const kind = computed({
  get: () => (isSpring.value ? 'spring' : 'curve'),
  set: (value: string) => {
    if (value === kind.value) return
    emit(
      'update',
      value === 'spring'
        ? easingPreset('GENTLE_SPRING')
        : { easing: 'CUSTOM_CUBIC', bezier: { ...FIRST_CURVE } }
    )
  }
})
const kindOptions = computed(() => [
  { value: 'curve', label: text.value.curve },
  { value: 'spring', label: text.value.spring }
])

/** A curve's numbers as one line, `0.42, 0, 1, 1`, as Figma's field writes them. */
function bezierText(curve: CubicBezier | undefined): string {
  if (!curve) return ''
  return [curve.x1, curve.y1, curve.x2, curve.y2]
    .map((value) => String(Number(value.toFixed(3))))
    .join(', ')
}
const bezierDraft = ref('')
watch(bezier, (curve) => (bezierDraft.value = bezierText(curve)), { immediate: true })

function commitBezier() {
  const parsed = parseCSSEasing(`cubic-bezier(${bezierDraft.value})`)
  if (parsed && easingBezier(parsed)) emit('update', parsed)
  else bezierDraft.value = bezierText(bezier.value)
}

/** The same curve played backwards, as Figma's Flip curve turns Ease in into Ease out. */
function flip() {
  const curve = bezier.value
  if (!curve) return
  // Rounded, so Ease in turned around is Ease out exactly, not 0.5800000000000001.
  const turned = (value: number) => Number((1 - value).toFixed(6))
  emit(
    'update',
    easingForBezier({
      x1: turned(curve.x2),
      y1: turned(curve.y2),
      x2: turned(curve.x1),
      y2: turned(curve.y1)
    })
  )
}

const mode = computed({
  get: () => (spring.value?.type === 'PHYSICAL' ? 'physics' : 'time'),
  set: (value: string) => {
    const current = spring.value
    if (!current || value === mode.value) return
    const { type: _type, platform: _platform, ...physics } = current
    emit(
      'update',
      value === 'physics'
        ? { easing: 'CUSTOM_SPRING', spring: { ...physics, type: 'PHYSICAL', platform: 'IOS_WEB' } }
        : { easing: 'CUSTOM_SPRING', spring: physics }
    )
  }
})
const modeOptions = computed(() => [
  { value: 'time', label: text.value.time },
  { value: 'physics', label: text.value.physics }
])

const platform = computed({
  get: () => spring.value?.platform ?? 'IOS_WEB',
  set: (value: string) => {
    if (value === 'IOS_WEB' || value === 'ANDROID') updatePhysics({ platform: value })
  }
})
const platformOptions = computed(() => [
  { value: 'IOS_WEB', label: text.value.iosWeb },
  { value: 'ANDROID', label: text.value.android }
])

const bounce = computed(() => (spring.value ? Number(springBounce(spring.value).toFixed(2)) : 0))

function setBounce(value: number) {
  emit('update', { easing: 'CUSTOM_SPRING', spring: springWithBounce(value) })
}

function updatePhysics(patch: Partial<Spring>) {
  const current = spring.value
  if (current) emit('update', { easing: 'CUSTOM_SPRING', spring: { ...current, ...patch } })
}

const physicsFields = computed(() => {
  const current = spring.value
  if (!current) return []
  return [
    { key: 'stiffness', label: text.value.stiffness, value: current.stiffness, min: 1 },
    { key: 'damping', label: text.value.damping, value: current.damping, min: 0 },
    { key: 'mass', label: text.value.mass, value: current.mass, min: 0.1 }
  ] as const
})
</script>

<template>
  <div :class="ui.editor()" data-test-id="easing-editor">
    <div :class="ui.header()">
      <AppSelect
        v-model="preset"
        class="min-w-0 flex-1"
        :label="text.presets"
        :options="presetOptions"
        size="sm"
        data-test-id="easing-preset"
      >
        <template #leading>
          <component :is="easingThumbnail(easing)" :class="ui.presetThumbnail()" />
        </template>
        <template #option="{ option }">
          <component :is="thumbnail(option.value)" :class="ui.presetThumbnail()" />
          {{ option.label }}
        </template>
      </AppSelect>
      <IconButton :label="text.close" @click="emit('close')">
        <icon-lucide-x class="size-3.5" />
      </IconButton>
    </div>
    <SegmentedControl v-model="kind" :label="text.kind" :options="kindOptions" />
    <EasingGraph :easing="easing" @update="(next, gesture) => emit('update', next, gesture)" />
    <div v-if="bezier" :class="ui.row()">
      <AppInput
        v-model="bezierDraft"
        class="min-w-0 flex-1"
        :aria-label="text.bezier"
        size="sm"
        dir="ltr"
        data-test-id="easing-bezier"
        @change="commitBezier"
      />
      <IconButton :label="text.flipCurve" data-test-id="easing-flip" @click="flip">
        <icon-lucide-flip-horizontal-2 class="size-3.5" />
      </IconButton>
    </div>
    <template v-else-if="spring">
      <SegmentedControl v-model="mode" :label="text.springMode" :options="modeOptions" />
      <NumberField
        v-if="mode === 'time'"
        :model-value="bounce"
        :label="text.bounce"
        :min="0"
        :max="1"
        :step="0.01"
        data-test-id="easing-bounce"
        @update:model-value="setBounce"
      />
      <template v-else>
        <SegmentedControl v-model="platform" :label="text.platform" :options="platformOptions" />
        <div :class="ui.fields()">
          <label v-for="field in physicsFields" :key="field.key" class="flex flex-col gap-1">
            <span :class="ui.fieldLabel()">{{ field.label }}</span>
            <NumberField
              :model-value="field.value"
              :aria-label="field.label"
              :min="field.min"
              :data-test-id="`easing-${field.key}`"
              @update:model-value="updatePhysics({ [field.key]: $event })"
            />
          </label>
        </div>
      </template>
    </template>
  </div>
</template>
