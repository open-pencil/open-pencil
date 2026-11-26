<script setup lang="ts">
import { useHead } from '@unhead/vue'
import { usePreferredDark } from '@vueuse/core'
import { computed, onMounted, onUnmounted, shallowRef, watchEffect } from 'vue'

import { provideEditor } from '@open-pencil/vue'
import { CanvasRoot, CanvasSurface } from '@open-pencil/vue/canvas'
import { useMessages } from '@open-pencil/vue/i18n'
import { PageListRoot } from '@open-pencil/vue/primitives/PageList'

import {
  EmbedUnavailableError,
  openEmbed,
  readEmbedSource,
  type OpenedEmbed
} from '@/app/embed/document'
import { createEmbedEditor } from '@/app/embed/editor'

/**
 * A Cloud document inside another site's page: the canvas, read-only, with its pages, a way to
 * fit it, and a link that opens it in the editor. Nothing here asks who the visitor is.
 */
const t = useMessages('cloud/embed')
const editor = createEmbedEditor()
provideEditor(editor)

const address = new URL(globalThis.location.href)
const source = readEmbedSource(address)
const prefersDark = usePreferredDark()
const requested = address.searchParams.get('theme')
const theme = computed(() => {
  if (requested === 'dark' || requested === 'light') return requested
  return prefersDark.value ? 'dark' : 'light'
})
watchEffect(() => {
  editor.state.theme = theme.value
  editor.requestRepaint()
})

type Shown = 'opening' | 'open' | 'unavailable' | 'failed'
const shown = shallowRef<Shown>(source ? 'opening' : 'unavailable')
const opened = shallowRef<OpenedEmbed | null>(null)
let opening: AbortController | null = null

useHead({
  title: computed(() => opened.value?.name),
  htmlAttrs: { 'data-theme': theme },
  style: [{ textContent: computed(() => `:root { color-scheme: ${theme.value}; }`) }]
})

async function open() {
  if (!source) return
  opening?.abort()
  opened.value?.close()
  opened.value = null
  const controller = new AbortController()
  opening = controller
  shown.value = 'opening'
  try {
    opened.value = await openEmbed(editor, source, {
      origin: address.origin,
      signal: controller.signal,
      onRestart: () => void open()
    })
    shown.value = 'open'
  } catch (error) {
    if (controller.signal.aborted) return
    console.warn('[Embed] Opening the document failed:', error)
    shown.value = error instanceof EmbedUnavailableError ? 'unavailable' : 'failed'
  }
}

onMounted(() => void open())
onUnmounted(() => {
  opening?.abort()
  opened.value?.close()
  editor.dispose()
})
</script>

<template>
  <main data-test-id="embed" class="relative h-dvh w-dvw overflow-hidden bg-canvas text-surface">
    <CanvasRoot>
      <CanvasSurface class="absolute inset-0 size-full" />
    </CanvasRoot>

    <div
      v-if="shown !== 'open'"
      role="status"
      :aria-busy="shown === 'opening'"
      class="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-canvas p-6 text-center text-sm"
    >
      <p v-if="shown === 'opening'" class="text-muted">{{ t.opening }}</p>
      <template v-else>
        <p>{{ shown === 'unavailable' ? t.unavailable : t.failed }}</p>
        <button
          v-if="shown === 'failed'"
          type="button"
          class="rounded-md border border-border px-3 py-1.5 hover:bg-hover"
          @click="open"
        >
          {{ t.tryAgain }}
        </button>
      </template>
    </div>

    <footer
      v-else
      class="pointer-events-none absolute inset-x-2 bottom-2 flex items-end justify-between gap-2 text-xs"
    >
      <PageListRoot v-slot="{ pages, currentPageId, actions }">
        <label
          v-if="pages.length > 1"
          class="pointer-events-auto flex items-center gap-2 rounded-md bg-panel px-2 py-1 shadow"
        >
          <span class="text-muted">{{ t.pages }}</span>
          <select
            :value="currentPageId"
            class="bg-transparent outline-none"
            @change="actions.switch(($event.target as HTMLSelectElement).value)"
          >
            <option v-for="page in pages" :key="page.id" :value="page.id">{{ page.name }}</option>
          </select>
        </label>
        <span v-else />
      </PageListRoot>
      <div class="pointer-events-auto flex items-center gap-1 rounded-md bg-panel p-1 shadow">
        <button type="button" class="rounded px-2 py-1 hover:bg-hover" @click="editor.zoomToFit()">
          {{ t.zoomToFit }}
        </button>
        <a
          v-if="opened"
          :href="opened.editorURL"
          target="_blank"
          rel="noopener"
          class="rounded px-2 py-1 hover:bg-hover"
        >
          {{ t.openInEditor }}
        </a>
      </div>
    </footer>
  </main>
</template>
