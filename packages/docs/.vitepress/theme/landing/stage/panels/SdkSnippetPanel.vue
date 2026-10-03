<script setup lang="ts">
import { useClipboard } from '@vueuse/core'
import dedent from 'dedent'

import CodeEditor from '@/components/code-editor/CodeEditor.vue'
import IconButton from '@/components/ui/button/IconButton.vue'

import { useLandingMessages } from '#docs/theme/landing/content/messages'

// A literal closing tag here would end this component's own script block.
const CLOSE_SCRIPT = `</${'script'}>`

/** The smallest working canvas: the same shape as `packages/vue/src/canvas/examples`. */
const SNIPPET = dedent`
  <script setup lang="ts">
  import { createEditor } from '@open-pencil/core/editor'
  import {
    CanvasRoot,
    CanvasSurface,
    provideEditor
  } from '@open-pencil/vue'

  const editor = createEditor()
  provideEditor(editor)
  ${CLOSE_SCRIPT}

  <template>
    <CanvasRoot>
      <CanvasSurface class="size-full" />
    </CanvasRoot>
  </template>
`

const INSTALL = 'bun add @open-pencil/core @open-pencil/vue canvaskit-wasm'
const FILE_NAME = 'Canvas.vue'

const messages = useLandingMessages()
const { copy, copied } = useClipboard({ copiedDuring: 2000 })
</script>

<template>
  <section class="flex min-h-0 flex-1 flex-col bg-panel" aria-label="SDK example">
    <header
      class="flex shrink-0 items-center gap-2 border-b border-border px-3 py-1.5 text-[11px] font-semibold text-surface"
    >
      <icon-lucide-file-code class="size-3.5 text-muted" aria-hidden="true" />
      {{ FILE_NAME }}
      <IconButton
        class="ml-auto"
        size="xs"
        :label="copied ? messages.stage.sdk.copied : messages.stage.sdk.copy"
        @click="copy(SNIPPET)"
      >
        <icon-lucide-check v-if="copied" class="size-3.5" />
        <icon-lucide-copy v-else class="size-3.5" />
      </IconButton>
    </header>
    <!-- The app's own code editor: its HTML mode highlights the script block as well. -->
    <div class="flex min-h-0 flex-1 flex-col select-text">
      <CodeEditor :model-value="SNIPPET" language="html-css" :label="FILE_NAME" read-only />
    </div>
    <p
      class="shrink-0 border-t border-border px-3 py-2 font-mono text-[11px] break-words text-muted select-text"
    >
      <span class="text-accent select-none">$ </span>{{ INSTALL }}
    </p>
  </section>
</template>
