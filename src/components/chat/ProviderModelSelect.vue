<script setup lang="ts">
import {
  SelectContent,
  SelectItem,
  SelectItemText,
  SelectPortal,
  SelectRoot,
  SelectTrigger,
  SelectViewport
} from 'reka-ui'

import { useSelectUI } from '@/components/ui/select'
import { useAIChat } from '@/app/ai/chat/use'

const { modelID, providerDef } = useAIChat()
const selectCls = useSelectUI({
  trigger: 'gap-1 rounded border-none bg-transparent px-1.5 py-0.5 text-[10px] text-muted',
  content: 'max-h-60 overflow-y-auto',
  item: 'gap-2 rounded px-2 py-1.5 text-[11px]'
})
</script>

<template>
  <SelectRoot v-model="modelID">
    <SelectTrigger data-test-id="chat-model-selector" :class="selectCls.trigger">
      <icon-lucide-bot class="size-3" />
      <slot name="value" />
      <icon-lucide-chevron-down class="size-2.5" />
    </SelectTrigger>
    <SelectPortal>
      <SelectContent position="popper" side="top" :side-offset="4" :class="selectCls.content">
        <SelectViewport>
          <SelectItem
            v-for="model in providerDef.models"
            :key="model.id"
            :value="model.id"
            :class="selectCls.item"
          >
            <SelectItemText class="flex-1">{{ model.name }}</SelectItemText>
            <span v-if="model.tag" class="rounded bg-accent/10 px-1 py-px text-[9px] text-accent">
              {{ model.tag }}
            </span>
          </SelectItem>
        </SelectViewport>
      </SelectContent>
    </SelectPortal>
  </SelectRoot>
</template>
