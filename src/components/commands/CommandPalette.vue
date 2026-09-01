<script setup lang="ts">
import { computed } from 'vue'
import { useEventListener } from '@vueuse/core'
import {
  CommandPaletteRoot,
  shortcutPlatform,
  useCommandMessages,
  useCommonMessages
} from '@open-pencil/vue'
import { DialogDescription, DialogTitle, VisuallyHidden } from 'reka-ui'

import Search from '~icons/lucide/search'
import X from '~icons/lucide/x'

import { IS_BROWSER } from '@/constants'
import { useAppMenu } from '@/app/shell/menu/app-menu'
import AppDialogRoot from '@/components/ui/dialog/AppDialogRoot.vue'
import { useCommandPaletteUI } from './ui'

const { commandGroups: groups } = useAppMenu()
const commands = useCommandMessages()
const common = useCommonMessages()
const paletteUI = useCommandPaletteUI()
const labels = computed(() => ({
  searchPlaceholder: commands.value.paletteSearchPlaceholder,
  searchLabel: commands.value.paletteSearchAriaLabel,
  paletteLabel: commands.value.paletteAriaLabel,
  empty: commands.value.paletteNoCommands,
  back: commands.value.paletteBack
}))
const open = defineModel<boolean>('open', { default: false })

function close() {
  open.value = false
}

if (IS_BROWSER) {
  const isMac = shortcutPlatform() === 'mac'
  useEventListener(window, 'keydown', (event) => {
    const hasPlatformModifier = isMac
      ? event.metaKey && !event.ctrlKey
      : event.ctrlKey && !event.metaKey
    if (!hasPlatformModifier || event.altKey || event.shiftKey || event.code !== 'KeyK') return
    event.preventDefault()
    open.value = true
  })
}
</script>

<template>
  <AppDialogRoot
    v-model:open="open"
    size="md"
    :ui="{
      content: 'w-[min(40rem,94vw)] p-0',
      overlay: 'bg-black/40'
    }"
    @escape-key-down="close"
  >
    <VisuallyHidden>
      <DialogTitle>{{ commands.paletteAriaLabel }}</DialogTitle>
      <DialogDescription>{{ commands.paletteDescription }}</DialogDescription>
    </VisuallyHidden>
    <CommandPaletteRoot :groups="groups" :labels="labels" :ui="paletteUI" @select="open = false">
      <template #search-leading>
        <Search class="mx-2 size-5 shrink-0 text-muted" />
      </template>
      <template #search-trailing>
        <button
          type="button"
          class="ml-2 inline-flex size-8 shrink-0 items-center justify-center rounded text-muted hover:bg-hover hover:text-surface"
          :aria-label="common.close"
          @click="close"
        >
          <X class="size-5" />
        </button>
      </template>
      <template #empty>
        <p class="px-4 py-8 text-center text-xs text-muted">
          {{ commands.paletteNoCommands }}
        </p>
      </template>
      <template #item-icon="{ item }">
        <component :is="item.icon" v-if="item.icon" class="size-4" />
      </template>
    </CommandPaletteRoot>
  </AppDialogRoot>
</template>
