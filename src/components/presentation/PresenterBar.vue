<script setup lang="ts">
import { computed } from 'vue'
import { tv } from 'tailwind-variants'

import { useI18n } from '@open-pencil/vue'

import { useEditorStore } from '@/app/editor/active-store'
import {
  presentFirst,
  presentNext,
  presentPrevious,
  presentationSlidePosition
} from '@/app/editor/presentation'
import Tip from '@/components/ui/Tip.vue'
import presentationTheme from '@/theme/presentation'

/**
 * Controls shown in the presenter's own window while the audience window is up.
 *
 * The editor stays as it is behind this — filmstrip, slide and notes are already the
 * presenter layout — so this only adds the driving controls and the way out.
 */
const store = useEditorStore()
const { dialogs } = useI18n()
const styles = tv(presentationTheme)()

const position = computed(() => presentationSlidePosition(store))
const positionLabel = computed(() =>
  dialogs.value.slidePosition({
    current: String(position.value.current),
    total: String(position.value.total)
  })
)
const atFirst = computed(() => position.value.current <= 1)
const atLast = computed(() => position.value.current >= position.value.total)

function exitPresenterMode() {
  store.state.presenterMode = false
}
</script>

<template>
  <div :class="styles.presenterBar()" data-test-id="presenter-bar">
    <Tip :label="dialogs.restartPresentation">
      <button
        type="button"
        data-test-id="presenter-restart"
        :class="styles.navButton()"
        :disabled="atFirst"
        :aria-label="dialogs.restartPresentation"
        @click="presentFirst(store)"
      >
        <icon-lucide-rotate-ccw class="size-4" />
      </button>
    </Tip>
    <button
      type="button"
      data-test-id="presenter-previous"
      :class="styles.navButton()"
      :disabled="atFirst"
      :aria-label="dialogs.previousSlide"
      @click="presentPrevious(store)"
    >
      <icon-lucide-chevron-left class="size-4" />
    </button>
    <span data-test-id="presenter-position" :class="styles.position()">{{ positionLabel }}</span>
    <button
      type="button"
      data-test-id="presenter-next"
      :class="styles.navButton()"
      :disabled="atLast"
      :aria-label="dialogs.nextSlide"
      @click="presentNext(store)"
    >
      <icon-lucide-chevron-right class="size-4" />
    </button>
    <span :class="styles.presenterDivider()" />
    <Tip :label="dialogs.exitPresentation">
      <button
        type="button"
        data-test-id="presenter-exit"
        :class="styles.navButton()"
        :aria-label="dialogs.exitPresentation"
        @click="exitPresenterMode"
      >
        <icon-lucide-x class="size-4" />
      </button>
    </Tip>
  </div>
</template>
