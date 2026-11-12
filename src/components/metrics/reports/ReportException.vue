<script setup lang="ts">
import { tv } from 'tailwind-variants'
import { computed, reactive } from 'vue'

import type { InboxException, InboxFrame } from '@open-pencil/feedback/contract'

import AppCopyButton from '@/components/ui/button/AppCopyButton.vue'
import { metricsExceptionTheme } from '@/theme/metrics/dashboard'

import { exceptionText, frameLocation } from './labels'

const metricsException = tv(metricsExceptionTheme)

/**
 * One exception of an error report, read the way an error tracker shows one: its type and message,
 * how it reached the app, then its frames with the most recent call first. The app's own frames
 * each take a row with the function over the file it is in, the one that threw marked; each run
 * of library frames folds into one line until opened. The whole trace copies as text.
 */
const { exception, cause = false } = defineProps<{
  exception: InboxException
  /** A cause of the exception before it, rather than the one thrown. */
  cause?: boolean
}>()

const ui = metricsException()

interface Frame {
  function: string
  location: ReturnType<typeof frameLocation> | null
}
type FrameGroup =
  | { kind: 'app'; frame: Frame; threw: boolean }
  | { kind: 'library'; frames: Frame[]; index: number }

const toFrame = (frame: InboxFrame): Frame => ({
  function: frame.function ?? '(anonymous)',
  location: frame.file ? frameLocation(frame) : null
})

const groups = computed(() => {
  const result: FrameGroup[] = []
  exception.frames.forEach((frame, index) => {
    const last = result.at(-1)
    if (frame.inApp) result.push({ kind: 'app', frame: toFrame(frame), threw: index === 0 })
    else if (last?.kind === 'library') last.frames.push(toFrame(frame))
    else result.push({ kind: 'library', frames: [toFrame(frame)], index })
  })
  return result
})
const opened = reactive(new Set<number>())
function toggle(index: number) {
  if (opened.has(index)) opened.delete(index)
  else opened.add(index)
}

const SOURCES: Record<string, string> = {
  window: 'window.onerror',
  rejection: 'unhandled rejection',
  vue: 'Vue error handler',
  panic: 'WASM panic'
}
const source = computed(() =>
  exception.source ? (SOURCES[exception.source] ?? exception.source) : null
)
const text = computed(() => exceptionText(exception))
const libraryLabel = (count: number) =>
  count === 1 ? '1 library frame' : `${count} library frames`
/** Some of the app's own frames point into the built bundle: source maps didn't cover them. */
const unresolved = computed(() => exception.frames.some((frame) => frame.inApp && !frame.resolved))
</script>

<template>
  <div :class="ui.root()">
    <div :class="ui.head()">
      <div :class="ui.heading()">
        <span v-if="cause" :class="ui.cause()">Caused by</span>
        <span :class="ui.type()">{{ exception.type }}</span>
        <span v-if="exception.message" :class="ui.message()">{{ exception.message }}</span>
        <div v-if="exception.handled !== null || source" :class="ui.tags()">
          <span v-if="exception.handled === false" :class="ui.unhandled()">Unhandled</span>
          <span v-else-if="exception.handled" :class="ui.tag()">Handled</span>
          <span v-if="source" :class="ui.tag()">{{ source }}</span>
        </div>
      </div>
      <AppCopyButton
        v-if="exception.frames.length"
        :value="text"
        label="Copy stack trace"
        copied-label="Copied"
        icon
        variant="ghost"
      />
    </div>

    <ol v-if="exception.frames.length" :class="ui.frames()" aria-label="Stack trace">
      <template v-for="(group, groupIndex) in groups" :key="groupIndex">
        <li v-if="group.kind === 'app'" :class="ui.frame()" :data-threw="group.threw">
          <span v-if="group.threw" :class="ui.threw()" aria-hidden="true" />
          <span :class="ui.function()">{{ group.frame.function }}</span>
          <span v-if="group.frame.location" :class="ui.path()">
            {{ group.frame.location.folder
            }}<span :class="ui.file()">{{ group.frame.location.file }}</span
            >{{ group.frame.location.position }}
          </span>
          <span v-if="group.threw" class="sr-only">Threw here</span>
        </li>
        <li v-else :class="ui.library()">
          <button
            type="button"
            :class="ui.folded()"
            :aria-expanded="opened.has(group.index)"
            @click="toggle(group.index)"
          >
            <icon-lucide-chevron-right
              v-if="!opened.has(group.index)"
              class="size-3"
              data-direction="reading"
            />
            <icon-lucide-chevron-down v-else class="size-3" />
            {{ libraryLabel(group.frames.length) }}
          </button>
          <template v-if="opened.has(group.index)">
            <span
              v-for="(frame, frameIndex) in group.frames"
              :key="frameIndex"
              :class="ui.libraryFrame()"
            >
              <span class="text-surface">{{ frame.function }}</span>
              <span v-if="frame.location" class="break-all">
                {{ frame.location.folder }}{{ frame.location.file }}{{ frame.location.position }}
              </span>
            </span>
          </template>
        </li>
      </template>
    </ol>
    <p :class="ui.footer()">
      <template v-if="exception.frames.length">Most recent call first.</template>
      <template v-else>No stack trace was sent.</template>
      <template v-if="unresolved">
        Some of the app’s frames weren’t mapped to the source; the issue in PostHog shows them once
        the release’s source maps are uploaded.
      </template>
    </p>
  </div>
</template>
