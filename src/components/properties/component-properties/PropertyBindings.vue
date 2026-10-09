<script setup lang="ts">
import { CollapsibleRoot, CollapsibleContent, CollapsibleTrigger } from 'reka-ui'

import {
  usePanelMessages,
  type ComponentBinding,
  type ComponentBindingGroup
} from '@open-pencil/vue'

import { sceneNodeIcon } from '@/app/editor/icons'
import AppButton from '@/components/ui/button/AppButton.vue'
import { collapsibleContentMotion } from '@/theme/collapsible/collapsible'

import PropertyBindingRow from './PropertyBindingRow.vue'

const { groups, totalVariants, disabled } = defineProps<{
  groups: ComponentBindingGroup[]
  totalVariants: number
  disabled?: boolean
}>()
defineEmits<{ select: [id: string]; unbind: [binding: ComponentBinding] }>()
const panels = usePanelMessages()
</script>

<template>
  <template v-for="group in groups" :key="group.key">
    <CollapsibleRoot v-if="group.bindings.length > 1" v-slot="{ open }">
      <CollapsibleTrigger as-child>
        <AppButton size="xs" variant="ghost" class="w-full justify-start gap-1">
          <icon-lucide-chevron-right
            class="size-3.5 shrink-0 transition-transform data-[open]:rotate-90 motion-reduce:transition-none"
            :data-open="open || undefined"
          />
          <component :is="sceneNodeIcon(group.node)" class="size-3.5 shrink-0" aria-hidden="true" />
          <span class="min-w-0 truncate">{{ group.name }}</span>
          <span class="ml-auto text-[10px] text-muted">{{
            group.bindings.length === totalVariants
              ? panels.allVariants
              : panels.usedInVariants({ count: group.bindings.length, total: totalVariants })
          }}</span>
        </AppButton>
      </CollapsibleTrigger>
      <CollapsibleContent :class="collapsibleContentMotion">
        <div class="flex flex-col gap-1 pl-3">
          <PropertyBindingRow
            v-for="binding in group.bindings"
            :key="binding.nodeId"
            :binding="binding"
            :disabled="disabled"
            @select="$emit('select', $event)"
            @unbind="$emit('unbind', $event)"
          />
        </div>
      </CollapsibleContent>
    </CollapsibleRoot>
    <PropertyBindingRow
      v-else
      v-for="binding in group.bindings"
      :key="binding.nodeId"
      :binding="binding"
      :disabled="disabled"
      @select="$emit('select', $event)"
      @unbind="$emit('unbind', $event)"
    />
  </template>
</template>
