<script setup lang="ts">
import { useFileDialog } from '@vueuse/core'
import { DialogTitle } from 'reka-ui'
import { computed, defineAsyncComponent, ref, shallowRef, watch } from 'vue'

import type { DesignTokenBundle } from '@open-pencil/core/io/formats/design-tokens'
import { errorMessage } from '@open-pencil/std/errors'
import { useDocumentShortcuts } from '@open-pencil/vue/editor/keyboard'
import { useI18n } from '@open-pencil/vue/i18n'

import { useEditorStore } from '@/app/editor/active-store'
import { createTokenCopy } from '@/app/editor/tokens/copy'
import {
  DESIGN_TOKEN_FILE_ACCEPT,
  exportDesignTokenArchive,
  readDesignTokenImport,
  readTokenPresetImport
} from '@/app/editor/tokens/design-tokens'
import { pendingTokenImport, requestedVariablesCollection } from '@/app/editor/tokens/dialog'
import { TOKEN_PRESET_NAMES, TOKEN_PRESETS, type TokenPreset } from '@/app/editor/tokens/presets'
import { notificationMessages } from '@/app/i18n/notifications'
import { toast } from '@/app/shell/ui'
import AppButton from '@/components/ui/button/AppButton.vue'
import IconButton from '@/components/ui/button/IconButton.vue'
import { AppDialogClose, AppDialogRoot } from '@/components/ui/dialog'
import TokenPresetPicker from '@/components/variables/TokenPresetPicker.vue'
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
  toast.error(notificationMessages.get().operationFailed({ error: errorMessage(error) }))
}

/** The latest import asked for; an earlier one still reading does not replace its preview. */
let importRequest = 0

/** Reads tokens to import; the import dialog shows what they would do. */
function previewImport(read: () => Promise<DesignTokenBundle>) {
  const request = ++importRequest
  void (async () => {
    const bundle = await read()
    if (request !== importRequest) return
    importBundle.value = bundle
    importOpen.value = true
  })().catch((error: unknown) => {
    if (request === importRequest) reportFailure(error)
  })
}

/** Token files, a folder's worth, or a zip of them. */
function importFiles(files: readonly File[]) {
  previewImport(() => readDesignTokenImport(files))
}

/** A preset's tokens, such as Tailwind's default colors and spacing. */
function loadPreset(chosen: TokenPreset) {
  previewImport(() => readTokenPresetImport(chosen))
}

const tokenFiles = useFileDialog({ accept: DESIGN_TOKEN_FILE_ACCEPT, multiple: true, reset: true })
tokenFiles.onChange((files) => {
  if (files?.length) importFiles([...files])
})

// Token files dropped on the window come here through the document's pending import.
const requestedCollection = requestedVariablesCollection(store)
const pendingImport = pendingTokenImport(store)
watch(
  pendingImport,
  (files) => {
    if (!files) return
    pendingImport.value = null
    importFiles(files)
  },
  { immediate: true }
)

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
    <TokensPanel
      v-model:requested-collection="requestedCollection"
      @copy="copyTokens"
      @export="exportTokens"
    >
      <template #actions>
        <TokenPresetPicker @load="loadPreset" />
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
      <template #empty-actions>
        <AppButton
          v-for="preset in TOKEN_PRESETS"
          :key="preset"
          color="primary"
          variant="solid"
          :data-test-id="`variables-empty-load-${preset}`"
          @click="loadPreset(preset)"
        >
          {{ variables.loadTokenPreset({ preset: TOKEN_PRESET_NAMES[preset] }) }}
        </AppButton>
      </template>
    </TokensPanel>
    <TokenImportDialog v-if="importBundle" v-model:open="importOpen" :bundle="importBundle" />
  </AppDialogRoot>
</template>
