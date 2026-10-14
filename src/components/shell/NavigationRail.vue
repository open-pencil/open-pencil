<script setup lang="ts">
import { tv } from 'tailwind-variants'
import { computed, ref } from 'vue'
import IconFile from '~icons/lucide/file'
import IconShapes from '~icons/lucide/shapes'

import { useI18n, vTestId } from '@open-pencil/vue'

import MainMenuButton from '@/components/shell/MainMenuButton.vue'
import Tip from '@/components/ui/overlay/Tip.vue'
import navigationRailTheme from '@/theme/shell/navigation-rail'

export type LeftPanelView = 'file' | 'assets'

/** Figma's navigation bar: the main menu and the left panel's views. Settings is in the main menu. */
const view = defineModel<LeftPanelView>({ required: true })

const { menu, panels } = useI18n()
const railStyles = tv(navigationRailTheme)
// While the main menu is open its button is the blue one, so the active view stands by.
const menuOpen = ref(false)
const base = railStyles()

const views = computed(() => [
  {
    value: 'file' as const,
    label: menu.value.file,
    icon: IconFile,
    testId: 'left-panel-layers-tab'
  },
  {
    value: 'assets' as const,
    label: panels.value.assets,
    icon: IconShapes,
    testId: 'left-panel-assets-tab'
  }
])
</script>

<template>
  <nav :aria-label="menu.navigation" :class="base.root()">
    <MainMenuButton v-model:open="menuOpen" />
    <div :class="base.separator()" />
    <Tip v-for="item in views" :key="item.value" as-child :label="item.label" side="right">
      <button
        type="button"
        v-test-id="item.testId"
        :aria-label="item.label"
        :aria-pressed="view === item.value"
        :class="
          railStyles({
            active: view === item.value && !menuOpen,
            standby: view === item.value && menuOpen
          }).item()
        "
        @click="view = item.value"
      >
        <component :is="item.icon" :class="base.icon()" />
      </button>
    </Tip>
  </nav>
</template>
