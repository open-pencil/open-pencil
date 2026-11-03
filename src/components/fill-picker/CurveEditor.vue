<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'

import { sampleCurve } from '@lawha/core/canvas'
import type { CurvePoint } from '@lawha/scene-graph'

/**
 * A tone-curve editor: drag a point to move it, click the curve to add one, double-click a
 * point to remove it. The two end points stay at x = 0 and x = 1. Always left to right, even in
 * RTL, because x is input brightness.
 */
const { points } = defineProps<{ points: CurvePoint[] | undefined }>()
const emit = defineEmits<{ update: [points: CurvePoint[]] }>()

const SIZE = 160
const IDENTITY: CurvePoint[] = [
  { x: 0, y: 0 },
  { x: 1, y: 1 }
]

const current = computed(() => (points && points.length >= 2 ? points : IDENTITY))
const canvas = ref<HTMLCanvasElement>()
const dragging = ref<number | null>(null)
const HIT = 0.05

function cssColor(name: string, fallback: string): string {
  const el = canvas.value
  if (!el) return fallback
  return getComputedStyle(el).getPropertyValue(name).trim() || fallback
}

function draw() {
  const el = canvas.value
  const ctx = el?.getContext('2d')
  if (!el || !ctx) return
  const ratio = window.devicePixelRatio || 1
  el.width = SIZE * ratio
  el.height = SIZE * ratio
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0)
  ctx.clearRect(0, 0, SIZE, SIZE)
  const border = cssColor('--color-border', '#555')
  const accent = cssColor('--color-accent', '#0d99ff')
  ctx.strokeStyle = border
  ctx.lineWidth = 0.5
  for (let i = 1; i < 4; i++) {
    const at = (i * SIZE) / 4
    ctx.beginPath()
    ctx.moveTo(at, 0)
    ctx.lineTo(at, SIZE)
    ctx.moveTo(0, at)
    ctx.lineTo(SIZE, at)
    ctx.stroke()
  }
  ctx.setLineDash([2, 2])
  ctx.beginPath()
  ctx.moveTo(0, SIZE)
  ctx.lineTo(SIZE, 0)
  ctx.stroke()
  ctx.setLineDash([])
  ctx.strokeStyle = accent
  ctx.lineWidth = 1.5
  ctx.beginPath()
  sampleCurve(current.value).forEach((y, i, all) => {
    const x = (i / (all.length - 1)) * SIZE
    if (i === 0) ctx.moveTo(x, (1 - y) * SIZE)
    else ctx.lineTo(x, (1 - y) * SIZE)
  })
  ctx.stroke()
  for (const p of current.value) {
    ctx.beginPath()
    ctx.arc(p.x * SIZE, (1 - p.y) * SIZE, 4, 0, Math.PI * 2)
    ctx.fillStyle = cssColor('--color-panel', '#222')
    ctx.fill()
    ctx.stroke()
  }
}

onMounted(draw)
watch(current, draw, { deep: true })

function hitIndex(p: CurvePoint): number {
  return current.value.findIndex((q) => Math.hypot(q.x - p.x, q.y - p.y) < HIT)
}

function down(event: PointerEvent) {
  const p = toPoint(event)
  const hit = hitIndex(p)
  if (hit >= 0) startDrag(hit, event)
  else addPoint(event)
}

function dblclick(event: MouseEvent) {
  const hit = hitIndex(toPoint(event))
  if (hit >= 0) remove(hit)
}

function toPoint(event: MouseEvent): CurvePoint {
  const box = canvas.value?.getBoundingClientRect()
  if (!box) return { x: 0, y: 0 }
  const clamp = (v: number) => Math.round(Math.max(0, Math.min(1, v)) * 1000) / 1000
  return {
    x: clamp((event.clientX - box.left) / box.width),
    y: clamp(1 - (event.clientY - box.top) / box.height)
  }
}

function startDrag(index: number, event: PointerEvent) {
  dragging.value = index
  canvas.value?.setPointerCapture(event.pointerId)
}

function addPoint(event: PointerEvent) {
  const p = toPoint(event)
  const next = [...current.value, p].sort((a, b) => a.x - b.x)
  emit('update', next)
  dragging.value = next.indexOf(p)
  canvas.value?.setPointerCapture(event.pointerId)
}

function move(event: PointerEvent) {
  const index = dragging.value
  if (index === null) return
  const list = current.value
  const p = toPoint(event)
  const last = list.length - 1
  // End points keep their x; inner points stay between their neighbours.
  if (index === 0) p.x = 0
  else if (index === last) p.x = 1
  else p.x = Math.min(list[index + 1].x - 0.01, Math.max(list[index - 1].x + 0.01, p.x))
  emit(
    'update',
    list.map((q, i) => (i === index ? p : q))
  )
}

function remove(index: number) {
  if (index === 0 || index === current.value.length - 1) return
  emit(
    'update',
    current.value.filter((_, i) => i !== index)
  )
}
</script>

<template>
  <canvas
    ref="canvas"
    class="aspect-square w-full touch-none rounded border border-border bg-input"
    data-test-id="curve-editor"
    @pointerdown="down"
    @pointermove="move"
    @pointerup="dragging = null"
    @pointercancel="dragging = null"
    @dblclick="dblclick"
  />
</template>
