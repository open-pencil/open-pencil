<script lang="ts">
import type { HTMLAttributes, VNode } from 'vue'

import type { ComponentUI } from '@/components/ui/types'
import type { CollapsibleTheme } from '@/theme/collapsible/collapsible'

export type AppCollapsibleUI = ComponentUI<CollapsibleTheme>

export interface AppCollapsibleProps {
  label?: string
  class?: HTMLAttributes['class']
  ui?: AppCollapsibleUI
}

export interface AppCollapsibleSlots {
  default?(): VNode[]
  label?(): VNode[]
  actions?(): VNode[]
}
</script>

<script setup lang="ts">
import { CollapsibleContent, CollapsibleRoot, CollapsibleTrigger } from 'reka-ui'
import { computed, normalizeClass, useAttrs } from 'vue'

import { collapsible } from '@/theme/collapsible/collapsible'

const { ui, class: className } = defineProps<AppCollapsibleProps>()
defineSlots<AppCollapsibleSlots>()
defineOptions({ inheritAttrs: false })

const attrs = useAttrs()
const open = defineModel<boolean>('open', { default: false })
const styles = computed(() => collapsible())
</script>

<template>
  <CollapsibleRoot
    v-bind="attrs"
    v-model:open="open"
    data-slot="root"
    :class="styles.root({ class: [ui?.root, normalizeClass(className)] })"
  >
    <div :class="styles.header({ class: ui?.header })">
      <CollapsibleTrigger
        :aria-label="label"
        :class="styles.trigger({ class: ui?.trigger })"
        data-slot="trigger"
      >
        <icon-lucide-chevron-right
          :class="styles.icon({ class: ui?.icon })"
          data-slot="icon"
          aria-hidden="true"
        />
        <span :class="styles.label({ class: ui?.label })" data-slot="label">
          <slot name="label">{{ label }}</slot>
        </span>
      </CollapsibleTrigger>
      <div
        v-if="$slots.actions"
        :class="styles.actions({ class: ui?.actions })"
        data-slot="actions"
      >
        <slot name="actions" />
      </div>
    </div>
    <CollapsibleContent :class="styles.content({ class: ui?.content })" data-slot="content">
      <slot />
    </CollapsibleContent>
  </CollapsibleRoot>
</template>
