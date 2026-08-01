<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { refAutoReset } from '@vueuse/core'
import { tv } from 'tailwind-variants'

import { useI18n } from '@open-pencil/vue'

import { useEditorStore } from '@/app/editor/active-store'
import {
  exitPresentation,
  presentNext,
  presentPrevious,
  presentationSlidePosition
} from '@/app/editor/presentation'
import presentationTheme from '@/theme/presentation'

/** How long the chrome lingers on entry before putting itself away. */
const CHROME_LINGER_MS = 2500
/**
 * Height of the band along the top edge that summons the chrome back.
 *
 * One trigger for both regions: moving the pointer across the slide does nothing, and
 * reaching the top brings back the bar, the counter and the exit together. Comfortably
 * taller than the bar itself so it can be hit without precision.
 */
const CHROME_ZONE_PX = 120

const store = useEditorStore()
const { dialogs } = useI18n()

/**
 * Visible on entry so the exit affordance is discoverable — otherwise the only way out of
 * a fullscreen deck is a key you have to already know about — then it fades.
 *
 * A linger rather than a plain "pointer is in the band" flag, because the controls it
 * reveals sit at the *bottom* of the screen: travelling down to click the pill leaves the
 * top band immediately, and an instant hide would pull them away mid-reach. Every sign of
 * the presenter re-arms the timer.
 *
 * The default must be `false`: `refAutoReset` starts its timer on assignment and resets
 * *back to the default*, so seeding it `true` would pin it on forever.
 */
const chromeVisible = refAutoReset(false, CHROME_LINGER_MS)
function keepChromeAlive() {
  chromeVisible.value = true
}
onMounted(keepChromeAlive)

function onCatcherPointerMove(event: PointerEvent) {
  const stage = event.currentTarget
  if (!(stage instanceof HTMLElement)) return
  const { top } = stage.getBoundingClientRect()
  if (event.clientY - top <= CHROME_ZONE_PX) keepChromeAlive()
}

const styles = computed(() => tv(presentationTheme)({ chromeVisible: chromeVisible.value }))

const position = computed(() => presentationSlidePosition(store))
const positionLabel = computed(() =>
  dialogs.value.slidePosition({
    current: String(position.value.current),
    total: String(position.value.total)
  })
)

function onCatcherClick(event: MouseEvent) {
  // Only primary button advances; ignore right-click / aux.
  if (event.button !== 0) return
  event.preventDefault()
  event.stopPropagation()
  // Deliberately does not reveal the chrome. Clicking through a deck is the normal way to
  // present, and it should not flash the counter and exit button on every slide.
  void presentNext(store)
}

// The deck does not wrap, so the arrows go dead at the ends rather than silently no-op.
const atFirst = computed(() => position.value.current <= 1)
const atLast = computed(() => position.value.current >= position.value.total)

function onExit() {
  exitPresentation(store)
}
</script>

<template>
  <!--
    Pointer catcher + chrome only. The canvas itself is teleported into the
    stage by EditorView; this overlay is a sibling that sits above it.
  -->
  <div
    data-test-id="presentation-catcher"
    :class="styles.catcher()"
    @pointerdown.stop.prevent
    @pointermove.stop.prevent="onCatcherPointerMove"
    @pointerup.stop.prevent
    @click="onCatcherClick"
    @contextmenu.prevent
  />
  <!-- Blended fill kept separate from the title so the text is not blended with it. -->
  <div :class="styles.topBarFill()" />
  <div
    :class="styles.topBar()"
    data-test-id="presentation-top-bar"
    :data-chrome-visible="chromeVisible ? 'true' : 'false'"
  >
    <span data-test-id="presentation-title" :class="styles.title()">
      <img src="/favicon-32.png" class="size-3.5" alt="" />
      {{ store.state.documentName }}
    </span>
  </div>
  <div
    :class="styles.chrome()"
    data-test-id="presentation-chrome"
    :data-chrome-visible="chromeVisible ? 'true' : 'false'"
    @pointermove="keepChromeAlive"
  >
    <div :class="styles.pill()" data-test-id="presentation-pill">
      <button
        type="button"
        data-test-id="presentation-previous"
        :class="styles.navButton()"
        :disabled="atFirst"
        :aria-label="dialogs.previousSlide"
        @click.stop="presentPrevious(store)"
      >
        <icon-lucide-chevron-left class="size-4" />
      </button>
      <span data-test-id="presentation-position" :class="styles.position()">
        {{ positionLabel }}
      </span>
      <button
        type="button"
        data-test-id="presentation-next"
        :class="styles.navButton()"
        :disabled="atLast"
        :aria-label="dialogs.nextSlide"
        @click.stop="presentNext(store)"
      >
        <icon-lucide-chevron-right class="size-4" />
      </button>
    </div>
    <button
      type="button"
      data-test-id="presentation-exit"
      :class="styles.exit()"
      :aria-label="dialogs.exitPresentation"
      @click.stop="onExit"
    >
      <icon-lucide-x class="size-4" />
    </button>
  </div>
</template>
