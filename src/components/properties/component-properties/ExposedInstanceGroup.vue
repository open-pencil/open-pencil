<script setup lang="ts">
import { CollapsibleContent, CollapsibleRoot, CollapsibleTrigger } from 'reka-ui'

import { useComponentProperties, useSceneComputed, useEditor } from '@open-pencil/vue'

import { collapsibleContentMotion } from '@/theme/collapsible/collapsible'

import ComponentPropertyControl from './ComponentPropertyControl.vue'
import ComponentPropertyRow from './ComponentPropertyRow.vue'

/** An exposed nested instance's properties, under its name, as Figma groups them. */
const { instanceId, name } = defineProps<{ instanceId: string; name: string }>()
const editor = useEditor()
const nested = useSceneComputed(() => {
  const node = editor.graph.getNode(instanceId)
  return node ? [node] : []
})
const { controls, setValue, setTextValue, flush } = useComponentProperties(() => nested.value)
</script>

<template>
  <CollapsibleRoot v-if="controls.length" v-slot="{ open }" default-open>
    <CollapsibleTrigger
      class="flex h-7 w-full items-center gap-1 text-left text-xs text-surface"
      :data-exposed-instance="name"
    >
      <icon-lucide-chevron-right
        class="size-3 shrink-0 text-muted transition-transform data-[open]:rotate-90 motion-reduce:transition-none"
        :data-open="open || undefined"
        aria-hidden="true"
      />
      <icon-lucide-component class="size-3.5 shrink-0 text-component" aria-hidden="true" />
      <span class="truncate">{{ name }}</span>
    </CollapsibleTrigger>
    <CollapsibleContent :class="collapsibleContentMotion">
      <div class="flex flex-col gap-1 pl-4">
        <ComponentPropertyRow v-for="control in controls" :key="control.id" :name="control.name">
          <ComponentPropertyControl
            :control="control"
            @set="setValue"
            @text="setTextValue"
            @flush="flush"
          />
        </ComponentPropertyRow>
      </div>
    </CollapsibleContent>
  </CollapsibleRoot>
</template>
