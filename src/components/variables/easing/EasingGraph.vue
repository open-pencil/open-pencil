<script setup lang="ts">
import { tv } from 'tailwind-variants'
import { computed, useTemplateRef } from 'vue'

import type { CubicBezier, Easing } from '@open-pencil/scene-graph'
import type { Vector } from '@open-pencil/scene-graph/primitives'
import {
  bounceForOvershoot,
  easingBezier,
  easingSpring,
  springBounce,
  springWithBounce
} from '@open-pencil/scene-graph/variables'
import { randomHex } from '@open-pencil/std/random'
import { useMessages } from '@open-pencil/vue/i18n'
import { vTestId } from '@open-pencil/vue/testing'

import { maskIcon } from '@/components/icons/mask'
import theme from '@/theme/variables/easing'

import {
  curvePoint,
  curveValue,
  easingDrawing,
  graphSVG,
  springHandle,
  springOvershoot,
  type GraphPoint
} from './graph'

/**
 * An easing drawn as Figma's editor draws it: a curve between its guides with handles on its
 * two control points, or a spring settling on its target with a handle on its first overshoot,
 * which sets its bounce. Handles drag, and arrow keys nudge them; a spring edited by its physics
 * takes its numbers from the fields instead.
 */
const { easing } = defineProps<{ easing: Easing }>()
/** `gesture` is shared by every change one drag makes, so the drag is one undo step. */
const emit = defineEmits<{ update: [easing: Easing, gesture?: string] }>()

const text = useMessages('variables/easing')
const ui = tv(theme)()
const graph = useTemplateRef('graph')

type HandleKind = 'first' | 'second' | 'bounce'

const drawing = computed(() => easingDrawing(easing))
const guides = computed(() => maskIcon(graphSVG(drawing.value.guides, 0.6)))
const arms = computed(() => maskIcon(graphSVG(drawing.value.arms, 0.6)))
const line = computed(() => maskIcon(graphSVG(drawing.value.line, 1.2)))

const bezier = computed(() => easingBezier(easing))
const spring = computed(() => easingSpring(easing))

const handles = computed<Array<{ kind: HandleKind; point: GraphPoint; label: string }>>(() => {
  const curve = bezier.value
  if (curve)
    return [
      { kind: 'first', point: curvePoint(curve.x1, curve.y1), label: text.value.firstHandle },
      { kind: 'second', point: curvePoint(curve.x2, curve.y2), label: text.value.secondHandle }
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
  const { x, y } = curveValue(point)
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
  const gesture = `easing:${randomHex(8)}`
  handle.setPointerCapture(event.pointerId)
  handle.focus()
  const move = (moveEvent: PointerEvent) => {
    const point = graphPoint(moveEvent)
    const next = point && movedTo(kind, point)
    if (next) emit('update', next, gesture)
  }
  const end = () => {
    handle.removeEventListener('pointermove', move)
    handle.removeEventListener('pointerup', end)
    handle.removeEventListener('pointercancel', end)
  }
  handle.addEventListener('pointermove', move)
  handle.addEventListener('pointerup', end)
  handle.addEventListener('pointercancel', end)
}

const NUDGES: Partial<Record<string, Vector>> = {
  ArrowLeft: { x: -1, y: 0 },
  ArrowRight: { x: 1, y: 0 },
  ArrowUp: { x: 0, y: 1 },
  ArrowDown: { x: 0, y: -1 }
}

/** Arrow keys move a handle a hundredth, ten with Shift; a bounce handle moves up and down. */
function nudge(kind: HandleKind, event: KeyboardEvent) {
  const direction = NUDGES[event.code]
  if (!direction) return
  event.preventDefault()
  const step = event.shiftKey ? 0.1 : 0.01
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
