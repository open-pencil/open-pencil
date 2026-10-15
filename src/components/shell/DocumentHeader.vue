<script setup lang="ts">
import { templateRef } from '@vueuse/core'
import { watch } from 'vue'

import { useI18n } from '@open-pencil/vue'

import { useEditorStore } from '@/app/editor/active-store'
import { useDocumentNameRename } from '@/app/shell/menu/document-name'
import { appMenuShortcutLabel } from '@/app/shell/menu/shortcut'
import IconButton from '@/components/ui/button/IconButton.vue'

/** The left panel's header, as in Figma: the document's name and the sidebar toggle. */
const store = useEditorStore()

const { rename, editingName, startRename, commitRename } = useDocumentNameRename(store)
const nameInput = templateRef<HTMLInputElement>('nameInput')

watch(nameInput, (input) => {
  if (input) void rename.focusInput(input)
})

const { menu: t } = useI18n()
</script>

<template>
  <div class="shrink-0 border-b border-border">
    <div class="flex h-12 items-center gap-2 px-2">
      <input
        v-if="editingName"
        ref="nameInput"
        data-test-id="app-document-name-input"
        class="min-w-0 flex-1 rounded border border-accent bg-input px-1 py-0.5 text-xs font-medium text-surface outline-none"
        :value="store.state.documentName"
        @blur="commitRename($event)"
        @keydown="rename.onKeydown"
      />
      <span
        v-else
        data-test-id="app-document-name"
        class="min-w-0 flex-1 cursor-default truncate rounded px-1 py-0.5 text-xs font-medium text-surface hover:bg-hover"
        @dblclick="startRename"
        >{{ store.state.documentName }}</span
      >
      <IconButton
        :label="`${t.toggleUI} (${appMenuShortcutLabel('toggle-ui')})`"
        data-test-id="app-toggle-ui"
        @click="store.state.showUI = !store.state.showUI"
      >
        <icon-lucide-panel-left class="size-4" />
      </IconButton>
    </div>
  </div>
</template>
