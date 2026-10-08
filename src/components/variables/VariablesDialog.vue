<script setup lang="ts">
import { useFileDialog } from '@vueuse/core'
import { DialogTitle } from 'reka-ui'
import { computed, defineAsyncComponent, ref, shallowRef } from 'vue'

import type { DesignTokenBundle } from '@open-pencil/core/io/formats/design-tokens'
import { useI18n } from '@open-pencil/vue'

import { useEditorStore } from '@/app/editor/active-store'
import { createTokenCopy } from '@/app/editor/tokens/copy'
import {
  DESIGN_TOKEN_FILE_ACCEPT,
  exportDesignTokenArchive,
  readDesignTokenFiles
} from '@/app/editor/tokens/design-tokens'
import { notificationMessages } from '@/app/i18n/notifications'
import { useDocumentShortcuts } from '@/app/shell/keyboard/document'
import { toast } from '@/app/shell/ui'
import IconButton from '@/components/ui/button/IconButton.vue'
import { AppDialogClose, AppDialogRoot } from '@/components/ui/dialog'
import TokensPanel from '@/components/variables/TokensPanel.vue'

const store = useEditorStore()
const open = computed({
  get: () => store.state.variablesOpen,
  set: (value: boolean) => {
    store.state.variablesOpen = value
  }
})

/** Undo and redo reach the document from inside the dialog, as they do on the canvas. */
const onKeydown = useDocumentShortcuts()

const { variables, common } = useI18n()
/** Expanding gives a large design system most of the window; it is kept for this session. */
const expanded = ref(false)
const copyTokens = createTokenCopy(store)

const TokenImportDialog = defineAsyncComponent(
  () => import('@/components/variables/TokenImportDialog.vue')
)
const importBundle = shallowRef<DesignTokenBundle | null>(null)
const importOpen = ref(false)

function reportFailure(error: unknown) {
  toast.error(
    notificationMessages
      .get()
      .operationFailed({ error: error instanceof Error ? error.message : String(error) })
  )
}

/** Token files, a folder's worth, or a zip of them; the import dialog shows what they would do. */
const tokenFiles = useFileDialog({ accept: DESIGN_TOKEN_FILE_ACCEPT, multiple: true, reset: true })
tokenFiles.onChange((files) => {
  if (!files?.length) return
  const picked = [...files]
  void (async () => {
    const sources = await readDesignTokenFiles(picked)
    const { readDesignTokens } = await import('@open-pencil/core/io/formats/design-tokens')
    importBundle.value = readDesignTokens(sources)
    importOpen.value = true
  })().catch(reportFailure)
})

function exportTokens() {
  exportDesignTokenArchive(store).catch(reportFailure)
}
</script>

<template>
  <AppDialogRoot
    v-model:open="open"
    :size="expanded ? 'screen' : 'xl'"
    :height="expanded ? 'screen' : 'full'"
    data-test-id="variables-dialog"
    @keydown="onKeydown"
    :aria-describedby="undefined"
  >
    <DialogTitle class="sr-only">{{ variables.localVariables }}</DialogTitle>
    <TokensPanel @copy="copyTokens" @export="exportTokens">
      <template #actions>
        <IconButton
          :label="variables.importDesignTokens"
          data-test-id="variables-import-tokens"
          @click="tokenFiles.open()"
        >
          <icon-lucide-file-input class="size-3.5" />
        </IconButton>
        <IconButton
          :label="expanded ? variables.collapse : variables.expand"
          data-test-id="variables-expand"
          @click="expanded = !expanded"
        >
          <icon-lucide-minimize-2 v-if="expanded" class="size-3.5" />
          <icon-lucide-maximize-2 v-else class="size-3.5" />
        </IconButton>
        <AppDialogClose :ariaLabel="common.close" />
      </template>
    </TokensPanel>
    <TokenImportDialog v-if="importBundle" v-model:open="importOpen" :bundle="importBundle" />
  </AppDialogRoot>
</template>
