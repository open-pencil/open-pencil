<script setup lang="ts">
import { useEventListener, useWindowSize } from '@vueuse/core'
import { computed, nextTick, onBeforeUnmount, ref, shallowRef, watch } from 'vue'

import {
  clickOutside,
  fire,
  hotspots,
  keyPress,
  readFlows,
  reachable,
  readingOrder,
  screensOf,
  start,
  timers,
  trigger,
  type Hotspot,
  type PlayerState,
  type Step,
  type Transition,
  type TriggerType
} from '@lawha/core/prototype'
import { usePrototypeMessages } from '@lawha/vue/i18n'

import { useEditorStore } from '@/app/editor/active-store'
import {
  closePlayer,
  outgoingOnTop,
  playerSession,
  transitionFrames,
  transitionTiming
} from '@/app/prototype/player'

const store = useEditorStore()
const t = usePrototypeMessages()
const { width: vw, height: vh } = useWindowSize()

const state = ref<PlayerState | null>(null)
/** The screen being animated away, drawn under (or over, for slide out) the current one. */
const leaving = ref<string | null>(null)
/** The transition now running, which decides whether the leaving screen draws on top. */
const running = ref<Transition | null>(null)
const images = shallowRef(new Map<string, string>())
const flashHotspots = ref(false)
const currentEl = ref<HTMLElement | null>(null)
const leavingEl = ref<HTMLElement | null>(null)
const overlayEls = ref<HTMLElement[]>([])
let timerIds: number[] = []

const graph = () => store.graph
const node = (id: string) => store.graph.getNode(id)

const screen = computed(() => (state.value ? node(state.value.screen) : null))

/** Fits the screen into the window with a margin, never upscaling past 2×. */
const scale = computed(() => {
  const s = screen.value
  if (!s) return 1
  return Math.min((vw.value - 48) / s.width, (vh.value - 96) / s.height, 2)
})

const flows = computed(() => {
  const session = playerSession.value
  const page = session ? node(session.pageId) : null
  return page ? readFlows(page) : []
})

async function imageFor(id: string): Promise<string> {
  const cached = images.value.get(id)
  if (cached) return cached
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  const bytes = await store.renderExportImage([id], dpr, 'PNG', playerSession.value?.pageId)
  if (!bytes) return ''
  const url = URL.createObjectURL(new Blob([bytes], { type: 'image/png' }))
  images.value = new Map(images.value).set(id, url)
  return url
}

function spotsFor(id: string): Hotspot[] {
  return hotspots(graph(), id)
}

function clearTimers() {
  for (const id of timerIds) window.clearTimeout(id)
  timerIds = []
}

/** Starts the active screen's After-delay timers for this state only. */
function scheduleTimers(current: PlayerState) {
  clearTimers()
  for (const { delay, action } of timers(graph(), current)) {
    timerIds.push(
      window.setTimeout(() => {
        if (state.value !== current) return
        void apply(fire(graph(), current, action))
      }, delay)
    )
  }
}

async function apply(step: Step | null) {
  if (!step || !state.value) return
  if (step.effect?.type === 'open-url') {
    window.open(step.effect.url, '_blank', 'noopener,noreferrer')
    return
  }
  if (step.effect) return
  const before = state.value
  const next = step.state
  const screenChanged = next.screen !== before.screen
  // Render what is about to show before animating, so nothing flashes empty.
  await Promise.all([imageFor(next.screen), ...next.overlays.map((o) => imageFor(o.screen))])
  leaving.value = screenChanged ? before.screen : null
  running.value = step.transition
  state.value = next
  await nextTick()
  const transition = step.transition
  if (transition && transition.type !== 'instant') {
    const frames = transitionFrames(transition)
    const timing = transitionTiming(transition)
    const openedOverlay = next.overlays.length > before.overlays.length
    let incoming: HTMLElement | null | undefined = null
    if (openedOverlay) incoming = overlayEls.value.at(-1)
    else if (screenChanged) incoming = currentEl.value
    const animations = [
      incoming && frames.incoming.length > 0 ? incoming.animate(frames.incoming, timing) : null,
      screenChanged && leavingEl.value && frames.outgoing.length > 0
        ? leavingEl.value.animate(frames.outgoing, timing)
        : null
    ].filter((a): a is Animation => a !== null)
    await Promise.all(animations.map((a) => a.finished.catch(() => undefined)))
  }
  leaving.value = null
  running.value = null
  scheduleTimers(next)
}

function onHotspot(spot: Hotspot, type: TriggerType) {
  if (!state.value || !spot.triggers.includes(type)) return
  void apply(trigger(graph(), state.value, spot.node, type))
}

/** A click that misses every hotspot briefly shows where they are, as Figma does. */
function onMiss() {
  flashHotspots.value = true
  window.setTimeout(() => (flashHotspots.value = false), 600)
}

function onBackdrop() {
  if (state.value) void apply(clickOutside(state.value))
}

async function restart(startId = playerSession.value?.start) {
  if (!startId) return
  clearTimers()
  await imageFor(startId)
  state.value = start(startId)
  scheduleTimers(state.value)
}

useEventListener(window, 'keydown', (event: KeyboardEvent) => {
  if (!playerSession.value || !state.value) return
  if (event.key === 'Escape') {
    if (state.value.overlays.length > 0)
      void apply(
        clickOutside({
          ...state.value,
          overlays: state.value.overlays.map((o) => ({ ...o, closeOnOutside: true }))
        })
      )
    else closePlayer()
    event.preventDefault()
    return
  }
  const step = keyPress(graph(), state.value, event.key)
  if (step) {
    event.preventDefault()
    void apply(step)
  }
})

watch(
  () => playerSession.value,
  (session) => {
    clearTimers()
    for (const url of images.value.values()) URL.revokeObjectURL(url)
    images.value = new Map()
    state.value = null
    if (session) void restart(session.start)
  },
  { immediate: true }
)

onBeforeUnmount(() => {
  clearTimers()
  for (const url of images.value.values()) URL.revokeObjectURL(url)
})

function overlayStyle(id: string, position: string) {
  const o = node(id)
  const s = screen.value
  if (!o || !s) return {}
  const w = o.width * scale.value
  const h = o.height * scale.value
  const W = s.width * scale.value
  const H = s.height * scale.value
  const at = {
    center: [(W - w) / 2, (H - h) / 2],
    top: [(W - w) / 2, 0],
    bottom: [(W - w) / 2, H - h],
    left: [0, (H - h) / 2],
    right: [W - w, (H - h) / 2]
  }[position] ?? [(W - w) / 2, (H - h) / 2]
  return { left: `${at[0]}px`, top: `${at[1]}px`, width: `${w}px`, height: `${h}px` }
}

/** Screens the prototype can reach from its start, in reading order, for "Screen X of Y". */
const journey = computed(() => {
  const session = playerSession.value
  if (!session) return []
  const reach = reachable(graph(), session.start, session.pageId)
  return readingOrder(screensOf(graph(), session.pageId)).filter((s) => reach.has(s.id))
})
const screenIndex = computed(() => journey.value.findIndex((s) => s.id === state.value?.screen) + 1)
</script>

<template>
  <div
    v-if="playerSession && state && screen"
    class="fixed inset-0 z-[1000] flex flex-col bg-[#0b0b0f] text-white"
    data-test-id="prototype-player"
    dir="ltr"
  >
    <header class="flex h-12 shrink-0 items-center gap-3 px-4 text-[12px]" :dir="undefined">
      <span class="font-medium" data-test-id="prototype-screen-name">{{ screen.name }}</span>
      <span class="text-white/50">{{
        t.screenOf({ current: screenIndex, total: journey.length })
      }}</span>
      <select
        v-if="flows.length > 1"
        class="rounded bg-white/10 px-2 py-1"
        :aria-label="t.flow"
        @change="restart(($event.target as HTMLSelectElement).value)"
      >
        <option v-for="flow in flows" :key="flow.name" :value="flow.start">{{ flow.name }}</option>
      </select>
      <span class="flex-1" />
      <button
        type="button"
        class="rounded px-2 py-1 hover:bg-white/10"
        data-test-id="prototype-restart"
        @click="restart()"
      >
        {{ t.restart }}
      </button>
      <button
        type="button"
        class="rounded px-2 py-1 hover:bg-white/10"
        data-test-id="prototype-close"
        @click="closePlayer"
      >
        {{ t.close }}
      </button>
    </header>

    <main class="flex flex-1 items-center justify-center overflow-hidden">
      <div
        class="relative overflow-hidden shadow-2xl"
        :style="{ width: `${screen.width * scale}px`, height: `${screen.height * scale}px` }"
        data-test-id="prototype-stage"
      >
        <div
          v-if="leaving"
          ref="leavingEl"
          class="absolute inset-0"
          :style="{ zIndex: outgoingOnTop(running) ? 2 : 0 }"
        >
          <img :src="images.get(leaving)" alt="" class="size-full select-none" draggable="false" />
        </div>
        <div ref="currentEl" class="absolute inset-0 z-[1]" @click.self="onMiss">
          <img
            :src="images.get(state.screen)"
            :alt="screen.name"
            class="pointer-events-none size-full select-none"
            draggable="false"
          />
          <button
            v-for="spot in spotsFor(state.screen)"
            :key="spot.node"
            type="button"
            class="absolute rounded-sm transition-colors"
            :class="
              flashHotspots ? 'bg-[rgb(56_189_248/0.3)] ring-2 ring-[#38bdf8]' : 'bg-transparent'
            "
            :data-hotspot="spot.node"
            :style="{
              left: `${spot.x * scale}px`,
              top: `${spot.y * scale}px`,
              width: `${spot.width * scale}px`,
              height: `${spot.height * scale}px`
            }"
            @click.stop="onHotspot(spot, 'click')"
            @mouseenter="onHotspot(spot, 'hover')"
            @pointerdown="onHotspot(spot, 'press')"
          />
        </div>

        <template v-for="(overlay, index) in state.overlays" :key="overlay.screen + index">
          <div class="absolute inset-0 z-[3] bg-black/40" @click="onBackdrop" />
          <div
            ref="overlayEls"
            class="absolute z-[4] overflow-hidden"
            :style="overlayStyle(overlay.screen, overlay.position)"
            :data-overlay="overlay.screen"
          >
            <img
              :src="images.get(overlay.screen)"
              alt=""
              class="pointer-events-none size-full"
              draggable="false"
            />
            <button
              v-for="spot in spotsFor(overlay.screen)"
              :key="spot.node"
              type="button"
              class="absolute"
              :data-hotspot="spot.node"
              :style="{
                left: `${spot.x * scale}px`,
                top: `${spot.y * scale}px`,
                width: `${spot.width * scale}px`,
                height: `${spot.height * scale}px`
              }"
              @click.stop="onHotspot(spot, 'click')"
              @mouseenter="onHotspot(spot, 'hover')"
            />
          </div>
        </template>
      </div>
    </main>
    <footer class="h-8 shrink-0 text-center text-[11px] text-white/40">{{ t.hintClick }}</footer>
  </div>
</template>
