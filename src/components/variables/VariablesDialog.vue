<script setup lang="ts">
import { DialogTitle } from 'reka-ui'
import { computed, ref } from 'vue'

import { useI18n } from '@open-pencil/vue'

import { useEditorStore } from '@/app/editor/active-store'
import { createTokenCopy } from '@/app/editor/tokens/copy'
import { useDocumentShortcuts } from '@/app/shell/keyboard/document'
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
    <TokensPanel @copy="copyTokens">
      <template #actions>
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
  </AppDialogRoot>
</template>
