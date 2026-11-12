<script setup lang="ts">
import { compact } from 'es-toolkit'
import { tv } from 'tailwind-variants'
import { computed, reactive } from 'vue'

import type { InboxException, InboxFrame } from '@open-pencil/feedback/contract'

import { metricsExceptionTheme } from '@/theme/metrics/dashboard'

import { frameLocation } from './labels'

const metricsException = tv(metricsExceptionTheme)

/**
 * One exception of an error report: its type and message, how it was caught, and its frames with
 * the most recent call first. The app's own frames stand out; each run of library frames folds
 * into one line until opened.
 */
const { exception, cause = false } = defineProps<{
  exception: InboxException
  /** A cause of the exception before it, rather than the one thrown. */
  cause?: boolean
}>()

const ui = metricsException()

type FrameGroup =
  | { kind: 'app'; frames: InboxFrame[] }
  | { kind: 'library'; frames: InboxFrame[]; index: number }

const groups = computed(() => {
  const result: FrameGroup[] = []
  for (const frame of exception.frames) {
    const last = result.at(-1)
    const kind = frame.inApp ? 'app' : 'library'
    if (last?.kind === kind) last.frames.push(frame)
    else
      result.push(
        kind === 'app' ? { kind, frames: [frame] } : { kind, frames: [frame], index: result.length }
      )
  }
  return result
})
const opened = reactive(new Set<number>())
function toggle(index: number) {
  if (opened.has(index)) opened.delete(index)
  else opened.add(index)
}

const caught = computed(() => {
  let how: string | null = null
  if (exception.handled !== null) how = exception.handled ? 'Caught' : 'Not caught by the app'
  const where = exception.source
    ? ({
        window: 'window error',
        rejection: 'unhandled promise rejection',
        vue: 'Vue error handler',
        panic: 'WASM panic'
      }[exception.source] ?? exception.source)
    : null
  return compact([cause ? 'Caused it' : null, how, where]).join(' · ')
})
/** Some of the app's own frames point into the built bundle: source maps didn't cover them. */
const unresolved = computed(() => exception.frames.some((frame) => frame.inApp && !frame.resolved))
</script>

<template>
  <div :class="ui.root()">
    <div :class="ui.head()">
      <span :class="ui.type()">{{ exception.type }}</span>
      <span v-if="exception.message" :class="ui.message()">{{ exception.message }}</span>
      <span v-if="caught" :class="ui.meta()">{{ caught }}</span>
    </div>
    <ol v-if="exception.frames.length" :class="ui.frames()">
      <template v-for="(group, groupIndex) in groups" :key="groupIndex">
        <template v-if="group.kind === 'app' || opened.has(group.index)">
          <li
            v-for="(frame, frameIndex) in group.frames"
            :key="frameIndex"
            :class="ui.frame()"
            :data-app="frame.inApp"
          >
            <span :class="ui.function()" :data-app="frame.inApp">
              {{ frame.function ?? '(anonymous)' }}
            </span>
            <span :class="ui.location()">{{ frameLocation(frame) }}</span>
          </li>
        </template>
        <li v-if="group.kind === 'library'">
          <button type="button" :class="ui.folded()" @click="toggle(group.index)">
            <icon-lucide-chevron-right
              v-if="!opened.has(group.index)"
              class="size-3"
              data-direction="reading"
            />
            <icon-lucide-chevron-down v-else class="size-3" />
            {{ opened.has(group.index) ? 'Hide' : 'Show' }} {{ group.frames.length }}
            {{ group.frames.length === 1 ? 'library frame' : 'library frames' }}
          </button>
        </li>
      </template>
    </ol>
    <p v-else :class="ui.unresolved()">No stack trace was sent.</p>
    <p v-if="unresolved" :class="ui.unresolved()">
      Some of the app’s frames weren’t mapped to the source; the issue in PostHog shows them once
      the release’s source maps are uploaded.
    </p>
  </div>
</template>
