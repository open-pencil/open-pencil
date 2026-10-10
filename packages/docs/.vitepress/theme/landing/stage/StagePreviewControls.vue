<script setup lang="ts">
import { tinykeys } from 'tinykeys'
import { onScopeDispose } from 'vue'

import { useI18n } from '@open-pencil/vue'

import { getActiveEditorStoreOrNull, useEditorStore } from '@/app/editor/active-store'
import { appMenuShortcutLabel, appMenuTinykeysShortcut } from '@/app/shell/menu/shortcut'
import WorkspacePill from '@/components/editor/WorkspacePill.vue'
import AppButton from '@/components/ui/button/AppButton.vue'

const PREVIEW_COMMAND = 'toggle-preview'

/**
 * The app's preview pill while the stage previews, and a way back into preview while it
 * edits. The app's own preview shortcut works too, for the stage the visitor last used.
 */
const store = useEditorStore()
const { menu } = useI18n()
const shortcut = appMenuShortcutLabel(PREVIEW_COMMAND) ?? ''

const keys = appMenuTinykeysShortcut(PREVIEW_COMMAND)
if (keys) {
  const unsubscribe = tinykeys(window, {
    [keys]: (event) => {
      if (getActiveEditorStoreOrNull() !== store) return
      event.preventDefault()
      store.togglePlay()
    }
  })
  onScopeDispose(unsubscribe)
}
</script>

<template>
  <WorkspacePill
    v-if="store.state.play"
    mode="preview"
    :document-name="store.state.documentName"
    :shortcut="shortcut"
    @reset="store.resetPlay()"
    @leave="store.stopPlay()"
  />
  <AppButton
    v-else
    class="absolute top-7 left-7 z-10 shadow-sm"
    variant="outline"
    size="sm"
    @click="store.startPlay()"
  >
    <template #leading><icon-lucide-play /></template>
    {{ menu.togglePreview }}
  </AppButton>
</template>
