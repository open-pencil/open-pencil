<script setup lang="ts">
import { tv } from 'tailwind-variants'
import { computed } from 'vue'
import IconAlignCenter from '~icons/lucide/align-center'
import IconAlignLeft from '~icons/lucide/align-left'
import IconAlignRight from '~icons/lucide/align-right'

import type { SceneNode } from '@open-pencil/scene-graph'
import type { FigJamTextSize, FigJamTypeface } from '@open-pencil/scene-graph/figjam'
import { useFigJamStyle } from '@open-pencil/vue/controls/figjam-style'
import { MIXED } from '@open-pencil/vue/controls/node-props'
import { useTypography } from '@open-pencil/vue/controls/typography'
import { useFigJamMessages, useI18n } from '@open-pencil/vue/i18n'

import { loadFont } from '@/app/editor/fonts'
import { useFigJamTextOptions } from '@/components/figjam/text-options'
import IconButton from '@/components/ui/button/IconButton.vue'
import theme from '@/theme/figjam/toolbar'

import ToolbarMenu from './ToolbarMenu.vue'
import ToolbarOptions, { type ToolbarOption } from './ToolbarOptions.vue'

/**
 * The text menus of FigJam's selection toolbar: typeface, size, bold, strikethrough and bullets,
 * and with `align` the text's alignment, for text and for the text of sticky notes and shapes.
 */
const { align = false } = defineProps<{ align?: boolean }>()

const toolbar = useFigJamStyle()
const typography = useTypography({ fontLoader: { load: loadFont } })
const figjam = useFigJamMessages()
const { menu, panels } = useI18n()
const { sizeOptions, typefaceOptions } = useFigJamTextOptions()
const styles = tv(theme)()

const sizeLabel = computed(
  () => sizeOptions.value.find((option) => option.value === toolbar.textSize.value)?.label ?? ''
)
const bold = computed(() => typography.activeFormatting.value.includes('bold'))
const strikethrough = computed(() => typography.activeFormatting.value.includes('strikethrough'))
const bulleted = computed(() => typography.listType.value === 'UNORDERED')

type TextAlign = SceneNode['textAlignHorizontal']

const alignOptions = computed<ToolbarOption<TextAlign>[]>(() => [
  { value: 'LEFT', label: panels.value.alignLeft, icon: IconAlignLeft },
  { value: 'CENTER', label: panels.value.alignCenter, icon: IconAlignCenter },
  { value: 'RIGHT', label: panels.value.alignRight, icon: IconAlignRight }
])
const textAlign = computed(() => {
  const value = typography.merged('textAlignHorizontal')
  return value === MIXED ? null : value
})
const alignIcon = computed(
  () => alignOptions.value.find((option) => option.value === textAlign.value)?.icon ?? IconAlignLeft
)

function setTypeface(value: FigJamTypeface) {
  void toolbar.setTypeface(value)
}

function setSize(value: FigJamTextSize) {
  toolbar.setTextSize(value)
}
</script>

<template>
  <ToolbarMenu :label="figjam.typeface" property="toolbar-typeface">
    <template #trigger>
      <icon-lucide-type class="size-4" />
    </template>
    <ToolbarOptions
      :label="figjam.typeface"
      :options="typefaceOptions"
      :selected="toolbar.typeface.value"
      @select="setTypeface"
    />
  </ToolbarMenu>
  <ToolbarMenu :label="figjam.textSize" property="toolbar-text-size">
    <template #trigger>
      <span :class="styles.triggerText()">{{ sizeLabel || toolbar.font.value }}</span>
    </template>
    <ToolbarOptions
      :label="figjam.textSize"
      :options="sizeOptions"
      :selected="toolbar.textSize.value"
      @select="setSize"
    />
  </ToolbarMenu>
  <span :class="styles.divider()" />
  <IconButton
    size="md"
    toggle
    :label="menu.bold"
    :active="bold"
    data-property="toolbar-bold"
    @click="typography.toggleBold()"
  >
    <icon-lucide-bold class="size-4" />
  </IconButton>
  <IconButton
    size="md"
    toggle
    :label="menu.strikethrough"
    :active="strikethrough"
    data-property="toolbar-strikethrough"
    @click="typography.toggleDecoration('STRIKETHROUGH')"
  >
    <icon-lucide-strikethrough class="size-4" />
  </IconButton>
  <IconButton
    size="md"
    toggle
    :label="panels.listBulleted"
    :active="bulleted"
    data-property="toolbar-bullets"
    @click="typography.setListType(bulleted ? 'NONE' : 'UNORDERED')"
  >
    <icon-lucide-list class="size-4" />
  </IconButton>
  <template v-if="align">
    <span :class="styles.divider()" />
    <ToolbarMenu :label="panels.textAlignment" property="toolbar-text-align">
      <template #trigger>
        <component :is="alignIcon" class="size-4" />
      </template>
      <ToolbarOptions
        :label="panels.textAlignment"
        :options="alignOptions"
        :selected="textAlign"
        @select="typography.setAlign($event)"
      />
    </ToolbarMenu>
  </template>
</template>
