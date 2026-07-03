<script setup lang="ts">
import { useSectionUI } from '@/components/ui/section'

interface PanelSectionUi {
  label?: string
  wrapper?: string
}

interface PanelSectionProps {
  label: string
  ui?: PanelSectionUi
}

const { label, ui } = defineProps<PanelSectionProps>()

const sectionCls = useSectionUI(ui)
</script>

<template>
  <section :class="sectionCls.wrapper">
    <div v-if="$slots.actions" class="flex items-center justify-between">
      <label :class="sectionCls.label">{{ label }}</label>
      <slot name="actions" />
    </div>
    <label v-else :class="sectionCls.label">{{ label }}</label>
    <slot />
  </section>
</template>
