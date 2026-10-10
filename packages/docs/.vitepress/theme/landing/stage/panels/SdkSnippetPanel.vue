<script setup lang="ts">
import { useLandingMessages } from '#docs/theme/landing/content/messages'
import { useClipboard } from '@vueuse/core'
import dedent from 'dedent'

import CodeEditor from '@/components/code-editor/CodeEditor.vue'
import IconButton from '@/components/ui/button/IconButton.vue'

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

/** What the snippet needs installed, shown on two lines and copied as one command. */
const INSTALL_PACKAGES = ['@open-pencil/core', '@open-pencil/vue', 'canvaskit-wasm'] as const
const INSTALL = `bun add ${INSTALL_PACKAGES.join(' ')}`
const FILE_NAME = 'Canvas.vue'
const COPIED_MS = 2000

const messages = useLandingMessages()
const snippetClipboard = useClipboard({ copiedDuring: COPIED_MS })
const installClipboard = useClipboard({ copiedDuring: COPIED_MS })
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
        :label="snippetClipboard.copied.value ? messages.stage.sdk.copied : messages.stage.sdk.copy"
        @click="snippetClipboard.copy(SNIPPET)"
      >
        <icon-lucide-check v-if="snippetClipboard.copied.value" class="size-3.5" />
        <icon-lucide-copy v-else class="size-3.5" />
      </IconButton>
    </header>
    <!-- The app's own code editor: its HTML mode highlights the script block as well. -->
    <div class="flex min-h-0 flex-1 flex-col select-text">
      <CodeEditor :model-value="SNIPPET" language="html-css" :label="FILE_NAME" read-only />
    </div>
    <footer class="shrink-0 border-t border-border">
      <header
        class="flex items-center gap-2 border-b border-border px-3 py-1.5 text-[11px] font-semibold text-surface"
      >
        <icon-lucide-terminal class="size-3.5 text-muted" aria-hidden="true" />
        {{ messages.stage.sdk.install }}
        <IconButton
          class="ml-auto"
          size="xs"
          :label="
            installClipboard.copied.value ? messages.stage.sdk.copied : messages.stage.sdk.copy
          "
          @click="installClipboard.copy(INSTALL)"
        >
          <icon-lucide-check v-if="installClipboard.copied.value" class="size-3.5" />
          <icon-lucide-copy v-else class="size-3.5" />
        </IconButton>
      </header>
      <!-- Two lines joined by the shell's line continuation, so no package name breaks. -->
      <pre
        class="m-0 overflow-x-auto px-3 py-2 font-mono text-[12px] leading-5 text-surface select-text"
      ><span class="text-muted select-none">$ </span><span class="text-accent">bun</span> add {{ INSTALL_PACKAGES[0] }} <span class="text-muted">\</span>
    {{ INSTALL_PACKAGES.slice(1).join(' ') }}</pre>
    </footer>
  </section>
</template>
