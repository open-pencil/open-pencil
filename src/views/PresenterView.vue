<script setup lang="ts">
import { useHead } from '@unhead/vue'
import { useEventListener, useIntervalFn, useTimestamp } from '@vueuse/core'
import { tv } from 'tailwind-variants'
import { computed, ref } from 'vue'

import { useLocale, useMessages } from '@open-pencil/vue/i18n'

import { usePresenter } from '@/app/editor/present/presenter'
import { useAppTheme } from '@/app/shell/theme'
import IconButton from '@/components/ui/button/IconButton.vue'
import presenterTheme from '@/theme/slides/presenter'

/**
 * The presenter's window: the slide on show and the next one, the speaker notes, a timer, and every
 * slide to jump to, beside the deck that fills the audience's screen.
 */
const ui = tv(presenterTheme)()
const messages = useMessages('slides')
const { locale } = useLocale()
const presentationId = decodeURIComponent(location.hash.slice(1))
const { status, ended, send } = usePresenter(presentationId)

useHead({ title: () => messages.value.presenterView, htmlAttrs: { lang: locale } })
useAppTheme()

const current = computed(() => status.value?.slides[status.value.index] ?? null)
const next = computed(() => status.value?.slides[status.value.index + 1] ?? null)

const NOTES_SIZES = [14, 16, 18, 22, 26, 32]
const notesSize = ref(2)

/** The timer counts from the presentation's start, or from when the presenter restarted it. */
const timerStart = ref<number | null>(null)
const now = useTimestamp({ interval: 1000 })
const elapsed = computed(() => {
  const start = timerStart.value ?? status.value?.startedAt
  if (start === undefined) return '0:00'
  const seconds = Math.max(0, Math.floor((now.value - start) / 1000))
  const minutes = Math.floor(seconds / 60)
  const rest = String(seconds % 60).padStart(2, '0')
  return minutes >= 60
    ? `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, '0')}:${rest}`
    : `${minutes}:${rest}`
})
const clock = computed(() =>
  new Intl.DateTimeFormat(locale.value, { hour: 'numeric', minute: '2-digit' }).format(now.value)
)

// Ask again until the presenting window answers: it may still be starting.
const { pause } = useIntervalFn(() => {
  if (status.value) pause()
  else send({ type: 'hello' })
}, 1000)

const NEXT_KEYS = new Set(['ArrowRight', 'ArrowDown', 'PageDown', ' ', 'Enter', 'n', 'N'])
const PREVIOUS_KEYS = new Set(['ArrowLeft', 'ArrowUp', 'PageUp', 'Backspace', 'p', 'P'])
useEventListener(window, 'keydown', (event: KeyboardEvent) => {
  if (event.target instanceof HTMLButtonElement && (event.key === ' ' || event.key === 'Enter'))
    return
  if (NEXT_KEYS.has(event.key)) send({ type: 'next' })
  else if (PREVIOUS_KEYS.has(event.key)) send({ type: 'previous' })
  else if (event.key === 'Home') send({ type: 'slide', index: 0 })
  else if (event.key === 'End' && status.value)
    send({ type: 'slide', index: status.value.slides.length - 1 })
  else if (event.key === 'Escape') send({ type: 'stop' })
  else return
  event.preventDefault()
})
</script>

<template>
  <div :class="ui.root()">
    <header :class="ui.header()">
      <span :class="ui.title()">{{ status?.title ?? messages.presenterView }}</span>
      <span v-if="status" :class="ui.meta()" data-test-id="presenter-counter">
        {{
          messages.presentedSlide({
            number: String(status.index + 1),
            total: String(status.slides.length)
          })
        }}
      </span>
      <span v-if="status && status.steps > 0" :class="ui.meta()">
        {{ messages.buildStep({ played: String(status.played), steps: String(status.steps) }) }}
      </span>
      <span :class="ui.meta()">{{ clock }}</span>
      <span :class="ui.timer()" data-test-id="presenter-timer">{{ elapsed }}</span>
      <IconButton :label="messages.restartTimer" @click="timerStart = Date.now()">
        <icon-lucide-timer-reset class="size-3.5" />
      </IconButton>
      <IconButton
        :label="messages.exitPresentation"
        :disabled="!status || ended"
        @click="send({ type: 'stop' })"
      >
        <icon-lucide-x class="size-3.5" />
      </IconButton>
    </header>

    <p v-if="ended" :class="ui.message()">{{ messages.presentationEnded }}</p>
    <p v-else-if="!status" :class="ui.message()">{{ messages.waitingForPresentation }}</p>
    <template v-else>
      <div :class="ui.body()">
        <section :class="ui.stage()">
          <div :class="ui.current()">
            <img
              v-if="current?.thumbnail"
              :src="current.thumbnail"
              alt=""
              :class="ui.image()"
              data-test-id="presenter-current"
            />
          </div>
          <div :class="ui.controls()">
            <IconButton :label="messages.previous" @click="send({ type: 'previous' })">
              <icon-lucide-chevron-left data-direction="reading" class="size-4" />
            </IconButton>
            <IconButton :label="messages.next" @click="send({ type: 'next' })">
              <icon-lucide-chevron-right data-direction="reading" class="size-4" />
            </IconButton>
          </div>
        </section>
        <aside :class="ui.side()">
          <span :class="ui.label()">{{ messages.nextSlide }}</span>
          <div :class="ui.next()" data-test-id="presenter-next">
            <img v-if="next?.thumbnail" :src="next.thumbnail" alt="" :class="ui.image()" />
            <span v-else-if="!next">{{ messages.endOfPresentation }}</span>
          </div>
          <div :class="ui.notesHeader()">
            <span :class="[ui.label(), 'flex-1']">{{ messages.notes }}</span>
            <IconButton
              :label="messages.smallerNotes"
              :disabled="notesSize === 0"
              @click="notesSize--"
            >
              <icon-lucide-minus class="size-3.5" />
            </IconButton>
            <IconButton
              :label="messages.largerNotes"
              :disabled="notesSize === NOTES_SIZES.length - 1"
              @click="notesSize++"
            >
              <icon-lucide-plus class="size-3.5" />
            </IconButton>
          </div>
          <div
            :class="ui.notes()"
            :style="{ fontSize: `${NOTES_SIZES[notesSize]}px` }"
            data-test-id="presenter-notes"
          >
            <span v-if="current?.notes">{{ current.notes }}</span>
            <span v-else :class="ui.empty()">{{ messages.noNotes }}</span>
          </div>
        </aside>
      </div>
      <nav :class="ui.strip()" :aria-label="messages.slides">
        <button
          v-for="(slide, index) in status.slides"
          :key="slide.id"
          type="button"
          :class="ui.thumb({ current: index === status.index })"
          :aria-label="messages.slideNumber({ number: String(slide.number) })"
          :aria-current="index === status.index ? 'true' : undefined"
          @click="send({ type: 'slide', index })"
        >
          <img v-if="slide.thumbnail" :src="slide.thumbnail" alt="" :class="ui.image()" />
          <span :class="ui.thumbNumber()">{{ slide.number }}</span>
        </button>
      </nav>
    </template>
  </div>
</template>
