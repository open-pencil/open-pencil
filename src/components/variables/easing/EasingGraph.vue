<script setup lang="ts">
import { matchesKeyboardEvent, type HotkeyChord } from '@tanstack/hotkeys'
import { tv } from 'tailwind-variants'
import { computed, ref, useTemplateRef } from 'vue'

import type { CubicBezier, Easing } from '@open-pencil/scene-graph'
import type { Vector } from '@open-pencil/scene-graph/primitives'
import {
  bounceForOvershoot,
  easingBezier,
  easingSpring,
  springBounce,
  springWithBounce
} from '@open-pencil/scene-graph/variables'
import { useMessages } from '@open-pencil/vue/i18n'
import { vTestId } from '@open-pencil/vue/testing'

import { maskIcon } from '@/components/icons/mask'
import theme from '@/theme/variables/easing'

import {
  curveFrame,
  curvePoint,
  curveValue,
  easingDrawing,
  graphSVG,
  springHandle,
  springOvershoot,
  type CurveFrame,
  type GraphPoint
} from './graph'

/**
 * An easing drawn as Figma's editor draws it: a curve between its guides with handles on its
 * two control points, or a spring settling on its target with a handle on its first overshoot,
 * which sets its bounce. Handles drag, and arrow keys nudge them; a spring edited by its physics
 * takes its numbers from the fields instead.
 */
const { easing } = defineProps<{ easing: Easing }>()
/**
 * A drag previews each move and updates once, on release, so the document and everything drawn
 * from it change once per drag rather than on every pointer move.
 */
const emit = defineEmits<{ update: [easing: Easing]; preview: [easing: Easing] }>()

const text = useMessages('variables/easing')
const ui = tv(theme)()
const graph = useTemplateRef('graph')

type HandleKind = 'first' | 'second' | 'bounce'

/**
 * The curve's frame, fitted to its handles; a drag keeps the one it started with, so the curve
 * does not rescale under the pointer.
 */
const dragFrame = ref<CurveFrame | null>(null)
const frame = computed(() => dragFrame.value ?? curveFrame(bezier.value))
const drawing = computed(() => easingDrawing(easing, frame.value))
const guides = computed(() => maskIcon(graphSVG(drawing.value.guides, 0.6)))
const arms = computed(() => maskIcon(graphSVG(drawing.value.arms, 0.6)))
const line = computed(() => maskIcon(graphSVG(drawing.value.line, 1.2)))

const bezier = computed(() => easingBezier(easing))
const spring = computed(() => easingSpring(easing))

const handles = computed<Array<{ kind: HandleKind; point: GraphPoint; label: string }>>(() => {
  const curve = bezier.value
  if (curve)
    return [
      {
        kind: 'first',
        point: curvePoint(curve.x1, curve.y1, frame.value),
        label: text.value.firstHandle
      },
      {
        kind: 'second',
        point: curvePoint(curve.x2, curve.y2, frame.value),
        label: text.value.secondHandle
      }
    ]
  const current = spring.value
  if (!current || current.type === 'PHYSICAL') return []
  return [{ kind: 'bounce', point: springHandle(current), label: text.value.bounceHandle }]
})

function rounded(value: number): number {
  return Math.round(value * 100) / 100
}

function withHandle(kind: 'first' | 'second', x: number, y: number): Easing | undefined {
  const curve = bezier.value
  if (!curve) return undefined
  const moved: CubicBezier =
    kind === 'first'
      ? { ...curve, x1: rounded(x), y1: rounded(y) }
      : { ...curve, x2: rounded(x), y2: rounded(y) }
  return { easing: 'CUSTOM_CUBIC', bezier: moved }
}

function withBounce(bounce: number): Easing {
  return { easing: 'CUSTOM_SPRING', spring: springWithBounce(rounded(bounce)) }
}

/** The easing with a handle moved to a point of the graph. */
function movedTo(kind: HandleKind, point: GraphPoint): Easing | undefined {
  if (kind === 'bounce') return withBounce(bounceForOvershoot(springOvershoot(point)))
  const { x, y } = curveValue(point, frame.value)
  return withHandle(kind, x, y)
}

function graphPoint(event: PointerEvent): GraphPoint | undefined {
  const box = graph.value?.getBoundingClientRect()
  if (!box || box.width === 0 || box.height === 0) return undefined
  return {
    x: ((event.clientX - box.left) / box.width) * 100,
    y: ((event.clientY - box.top) / box.height) * 100
  }
}

function startDrag(kind: HandleKind, event: PointerEvent) {
  if (event.button !== 0 || !(event.currentTarget instanceof HTMLElement)) return
  const handle = event.currentTarget
  handle.setPointerCapture(event.pointerId)
  handle.focus()
  dragFrame.value = frame.value
  let moved: Easing | undefined
  const move = (moveEvent: PointerEvent) => {
    const point = graphPoint(moveEvent)
    const next = point && movedTo(kind, point)
    if (!next) return
    moved = next
    emit('preview', next)
  }
  const end = () => {
    if (moved) emit('update', moved)
    dragFrame.value = null
    handle.removeEventListener('pointermove', move)
    handle.removeEventListener('pointerup', end)
    handle.removeEventListener('pointercancel', end)
  }
  handle.addEventListener('pointermove', move)
  handle.addEventListener('pointerup', end)
  handle.addEventListener('pointercancel', end)
}

/** The keys that nudge a handle: arrows move it a hundredth, ten times as far with Shift. */
const NUDGES: ReadonlyArray<{ chord: HotkeyChord; direction: Vector; step: number }> = [
  { chord: 'ArrowLeft', direction: { x: -1, y: 0 }, step: 0.01 },
  { chord: 'ArrowRight', direction: { x: 1, y: 0 }, step: 0.01 },
  { chord: 'ArrowUp', direction: { x: 0, y: 1 }, step: 0.01 },
  { chord: 'ArrowDown', direction: { x: 0, y: -1 }, step: 0.01 },
  { chord: 'Shift+ArrowLeft', direction: { x: -1, y: 0 }, step: 0.1 },
  { chord: 'Shift+ArrowRight', direction: { x: 1, y: 0 }, step: 0.1 },
  { chord: 'Shift+ArrowUp', direction: { x: 0, y: 1 }, step: 0.1 },
  { chord: 'Shift+ArrowDown', direction: { x: 0, y: -1 }, step: 0.1 }
]

/** A bounce handle moves only up and down. */
function nudge(kind: HandleKind, event: KeyboardEvent) {
  const nudged = NUDGES.find(({ chord }) => matchesKeyboardEvent(event, chord))
  if (!nudged) return
  event.preventDefault()
  const { direction, step } = nudged
  let next: Easing | undefined
  if (kind === 'bounce') {
    const current = spring.value
    if (!current || direction.y === 0) return
    next = withBounce(Math.min(1, Math.max(0, springBounce(current) + direction.y * step)))
  } else {
    const curve = bezier.value
    if (!curve) return
    const [x, y] = kind === 'first' ? [curve.x1, curve.y1] : [curve.x2, curve.y2]
    next = withHandle(
      kind,
      Math.min(1, Math.max(0, x + direction.x * step)),
      y + direction.y * step
    )
  }
  if (next) emit('update', next)
}
</script>

<template>
  <div ref="graph" :class="ui.graph()" dir="ltr">
    <component :is="guides" :class="ui.guides()" />
    <component :is="arms" :class="ui.arms()" />
    <component :is="line" :class="ui.line()" />
    <button
      v-for="handle in handles"
      :key="handle.kind"
      type="button"
      :class="ui.handle()"
      :style="{ left: `${handle.point.x}%`, top: `${handle.point.y}%` }"
      :aria-label="handle.label"
      v-test-id="`easing-handle-${handle.kind}`"
      @pointerdown="startDrag(handle.kind, $event)"
      @keydown="nudge(handle.kind, $event)"
    />
  </div>
</template>
