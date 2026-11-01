<script setup lang="ts">
import {
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuRoot,
  DropdownMenuTrigger
} from 'reka-ui'

import { useI18n } from '@open-pencil/vue/i18n'

import { menu } from '@/components/ui/menu/menu'
import Tip from '@/components/ui/overlay/Tip.vue'

import { chatContextTheme } from './ui'

/**
 * What a message can take besides its text, in one menu: images, the selected layers, and the
 * commands and skills the field offers after `/`.
 */
const {
  disabled = false,
  canAttach = true,
  canMention = true
} = defineProps<{ disabled?: boolean; canAttach?: boolean; canMention?: boolean }>()
const emit = defineEmits<{ attach: []; mention: []; command: [] }>()
const { ai } = useI18n()
const ui = chatContextTheme()
const menuUI = menu()
</script>

<template>
  <DropdownMenuRoot :modal="false">
    <Tip :label="ai.addToMessage" as-child>
      <DropdownMenuTrigger
        :class="ui.addTrigger()"
        :disabled="disabled"
        :aria-label="ai.addToMessage"
        data-test-id="chat-add-menu"
      >
        <icon-lucide-plus class="size-3.5" aria-hidden="true" />
      </DropdownMenuTrigger>
    </Tip>
    <DropdownMenuPortal>
      <DropdownMenuContent side="top" align="start" :side-offset="6" :class="menuUI.content()">
        <DropdownMenuItem
          :class="menuUI.item({ justify: 'start' })"
          :disabled="!canAttach"
          @select="emit('attach')"
        >
          <icon-lucide-image-plus :class="menuUI.icon()" aria-hidden="true" />
          {{ ai.attachImages }}
        </DropdownMenuItem>
        <DropdownMenuItem
          :class="menuUI.item({ justify: 'start' })"
          :disabled="!canMention"
          data-slot="chat-mention-selection"
          @select="emit('mention')"
        >
          <icon-lucide-mouse-pointer-2 :class="menuUI.icon()" aria-hidden="true" />
          {{ ai.mentionSelection }}
        </DropdownMenuItem>
        <DropdownMenuItem :class="menuUI.item({ justify: 'start' })" @select="emit('command')">
          <icon-lucide-square-slash :class="menuUI.icon()" aria-hidden="true" />
          {{ ai.commandsAndSkills }}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenuPortal>
  </DropdownMenuRoot>
</template>
