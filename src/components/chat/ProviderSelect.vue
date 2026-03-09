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

import { selectContent, selectItem, selectTrigger } from '@/components/ui/select'
import { AI_PROVIDERS } from '@open-pencil/core'
import { useAIChat } from '@/composables/use-chat'

const { providerID, providerDef } = useAIChat()

const { triggerClass, itemClass, testId } = defineProps<{
  triggerClass?: string
  itemClass?: string
  testId?: string
}>()
</script>

<template>
  <SelectRoot v-model="providerID">
    <SelectTrigger
      :data-test-id="testId"
      :class="
        selectTrigger({
          class:
            triggerClass ??
            'w-full justify-between rounded border border-border bg-input px-2 py-1 text-[11px] text-surface'
        })
      "
    >
      {{ providerDef.name }}
      <icon-lucide-chevron-down class="size-2.5 shrink-0 text-muted" />
    </SelectTrigger>
    <SelectPortal>
      <SelectContent
        position="popper"
        :side-offset="4"
        :class="selectContent({ radius: 'lg', padding: 'md' })"
      >
        <SelectViewport>
          <SelectItem
            v-for="provider in AI_PROVIDERS"
            :key="provider.id"
            :value="provider.id"
            :class="selectItem({ class: itemClass ?? 'rounded px-2 py-1 text-[11px]' })"
          >
            <SelectItemText>{{ provider.name }}</SelectItemText>
          </SelectItem>
        </SelectViewport>
      </SelectContent>
    </SelectPortal>
  </SelectRoot>
</template>
