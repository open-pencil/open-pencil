<script lang="ts">
import type { VNode } from 'vue'
import type { ClassValue } from 'tailwind-variants'

import type { ComponentUI } from '@/components/ui/types'
import type { PanelSectionTheme } from '@/theme/panel/section'

export interface PanelSectionProps {
  label: string
  open?: boolean
  defaultOpen?: boolean
  empty?: boolean
  class?: ClassValue
  ui?: ComponentUI<PanelSectionTheme>
}

export interface PanelSectionSlots {
  default(): VNode[]
  actions?(): VNode[]
  emptyAction?(): VNode[]
}
</script>

<script setup lang="ts">
import { computed, getCurrentInstance } from 'vue'
import { tv } from 'tailwind-variants'
import {
  PropertySectionActions,
  PropertySectionContent,
  PropertySectionEmptyAction,
  PropertySectionHeader,
  PropertySectionRoot,
  PropertySectionTitle
} from '@open-pencil/vue'

import theme from '@/theme/panel/section'

const {
  label,
  open,
  defaultOpen = true,
  empty = false,
  class: className,
  ui
} = defineProps<PanelSectionProps>()
const vnodeProps = getCurrentInstance()?.vnode.props
const controlled = vnodeProps ? Object.hasOwn(vnodeProps, 'open') : false
const emit = defineEmits<{ 'update:open': [open: boolean] }>()
const slots = defineSlots<PanelSectionSlots>()

const styles = computed(() => tv(theme)({ actions: Boolean(slots.actions) }))
</script>

<template>
  <PropertySectionRoot
    as="section"
    v-bind="controlled ? { open } : {}"
    :default-open="defaultOpen"
    :empty="empty"
    :aria-label="label"
    :class="styles.root({ class: [ui?.root, className] })"
    @update:open="emit('update:open', $event)"
  >
    <PropertySectionHeader :class="styles.header({ class: ui?.header })">
      <PropertySectionTitle :class="styles.title({ class: ui?.title })">
        <span role="heading" aria-level="3">{{ label }}</span>
      </PropertySectionTitle>
      <PropertySectionActions v-if="slots.actions" :class="styles.actions({ class: ui?.actions })">
        <slot name="actions" />
      </PropertySectionActions>
    </PropertySectionHeader>
    <PropertySectionContent :class="styles.body({ class: ui?.body })">
      <slot />
      <PropertySectionEmptyAction v-if="slots.emptyAction" as-child>
        <slot name="emptyAction" />
      </PropertySectionEmptyAction>
    </PropertySectionContent>
  </PropertySectionRoot>
</template>
