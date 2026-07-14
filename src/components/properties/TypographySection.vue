<script setup lang="ts">
import { computed } from 'vue'

import { TypographyControlsRoot, useI18n } from '@open-pencil/vue'

import FontPicker from '@/components/font-picker/FontPicker.vue'
import FontSettingsPopover from '@/components/FontSettings/FontSettingsPopover.vue'
import VariableNumberField from '@/components/properties/VariableNumberField.vue'
import AppSelect from '@/components/ui/AppSelect.vue'
import IconButton from '@/components/ui/IconButton.vue'
import PanelFieldGroup from '@/components/ui/panel/PanelFieldGroup.vue'
import PanelGrid from '@/components/ui/panel/PanelGrid.vue'
import PanelSection from '@/components/ui/panel/PanelSection.vue'
import SegmentedControl from '@/components/ui/SegmentedControl.vue'
import Tip from '@/components/ui/Tip.vue'
import { loadFont } from '@/app/editor/fonts'
import { appMenuShortcutLabel } from '@/app/shell/menu/shortcut'

const { panels, menu } = useI18n()
const fontLoader = { load: loadFont }
const alignmentOptions = computed(() => [
  { value: 'LEFT', label: panels.value.alignLeft },
  { value: 'CENTER', label: panels.value.alignCenterHorizontally },
  { value: 'RIGHT', label: panels.value.alignRight }
])
</script>

<template>
  <TypographyControlsRoot v-slot="ctx" :font-loader="fontLoader">
    <PanelSection v-if="ctx.node.value" :label="panels.typography">
      <div class="mb-panel flex min-w-0 items-center gap-panel">
        <FontPicker
          class="min-w-0 flex-1"
          :model-value="ctx.node.value.fontFamily"
          :label="panels.fontFamily"
          @select="ctx.actions.setFamily"
        />
        <FontSettingsPopover />
        <Tip
          v-if="ctx.hasMissingFonts.value"
          :label="
            'Missing font' +
            (ctx.missingFonts.value.length > 1 ? 's' : '') +
            ': ' +
            ctx.missingFonts.value.join(', ')
          "
        >
          <icon-lucide-alert-triangle
            role="img"
            :aria-label="
              'Missing font' +
              (ctx.missingFonts.value.length > 1 ? 's' : '') +
              ': ' +
              ctx.missingFonts.value.join(', ')
            "
            class="size-3.5 shrink-0 text-[var(--color-warning-action)]"
          />
        </Tip>
      </div>

      <PanelGrid columns="two" class="mb-panel">
        <PanelFieldGroup :label="panels.fontWeight">
          <AppSelect
            :label="panels.fontWeight"
            :model-value="ctx.node.value.fontWeight"
            :options="ctx.weights"
            @update:model-value="ctx.actions.setWeight(+$event)"
          />
        </PanelFieldGroup>
        <PanelFieldGroup :label="panels.fontSize">
          <VariableNumberField
            :model-value="ctx.node.value.fontSize"
            :aria-label="panels.fontSize"
            :min="1"
            :max="1000"
            :node-id="ctx.node.value.id"
            binding-path="fontSize"
            @update:model-value="ctx.actions.updateProp('fontSize', $event)"
            @commit="(v: number, p: number) => ctx.actions.commitProp('fontSize', v, p)"
          />
        </PanelFieldGroup>
      </PanelGrid>

      <PanelGrid columns="two" class="mb-panel">
        <PanelFieldGroup :label="panels.lineHeight">
          <VariableNumberField
            :model-value="
              ctx.node.value.lineHeight ?? Math.round((ctx.node.value.fontSize || 14) * 1.2)
            "
            :aria-label="panels.lineHeight"
            :min="0"
            :node-id="ctx.node.value.id"
            binding-path="lineHeight"
            @update:model-value="ctx.actions.updateProp('lineHeight', $event)"
            @commit="(v: number, p: number) => ctx.actions.commitProp('lineHeight', v, p)"
          >
            <template #icon>
              <icon-lucide-baseline class="size-3" />
            </template>
          </VariableNumberField>
        </PanelFieldGroup>
        <PanelFieldGroup :label="panels.letterSpacing">
          <VariableNumberField
            suffix="%"
            :model-value="ctx.node.value.letterSpacing"
            :aria-label="panels.letterSpacing"
            :node-id="ctx.node.value.id"
            binding-path="letterSpacing"
            @update:model-value="ctx.actions.updateProp('letterSpacing', $event)"
            @commit="(v: number, p: number) => ctx.actions.commitProp('letterSpacing', v, p)"
          >
            <template #icon>
              <icon-lucide-a-large-small class="size-3" />
            </template>
          </VariableNumberField>
        </PanelFieldGroup>
      </PanelGrid>

      <PanelFieldGroup :label="panels.direction" class="mb-panel">
        <AppSelect
          :label="panels.direction"
          :model-value="ctx.node.value.textDirection"
          :options="[
            { value: 'AUTO', label: panels.auto },
            { value: 'LTR', label: 'LTR' },
            { value: 'RTL', label: 'RTL' }
          ]"
          @update:model-value="ctx.actions.setDirection($event as 'AUTO' | 'LTR' | 'RTL')"
        />
      </PanelFieldGroup>

      <PanelFieldGroup :label="panels.textAlignment" class="mb-panel">
        <SegmentedControl
          :model-value="ctx.node.value.textAlignHorizontal"
          :options="alignmentOptions"
          :label="panels.textAlignment"
          @change="ctx.actions.align($event as 'LEFT' | 'CENTER' | 'RIGHT')"
        >
          <template #option="{ option }">
            <icon-lucide-align-left v-if="option.value === 'LEFT'" class="size-3.5" />
            <icon-lucide-align-center v-else-if="option.value === 'CENTER'" class="size-3.5" />
            <icon-lucide-align-right v-else class="size-3.5" />
          </template>
        </SegmentedControl>
      </PanelFieldGroup>

      <PanelFieldGroup :label="panels.textFormatting" :ui="{ container: 'flex-row gap-panel' }">
        <div class="flex items-center gap-panel" role="toolbar" :aria-label="panels.textFormatting">
          <IconButton
            :label="`${menu.bold} (${appMenuShortcutLabel('text.bold')})`"
            size="md"
            :active="ctx.activeFormatting.value.includes('bold')"
            @click="ctx.actions.toggleBold"
          >
            <icon-lucide-bold class="size-3.5" />
          </IconButton>
          <IconButton
            :label="`${menu.italic} (${appMenuShortcutLabel('text.italic')})`"
            size="md"
            :active="ctx.activeFormatting.value.includes('italic')"
            @click="ctx.actions.toggleItalic"
          >
            <icon-lucide-italic class="size-3.5" />
          </IconButton>
          <IconButton
            :label="`${menu.underline} (${appMenuShortcutLabel('text.underline')})`"
            size="md"
            :active="ctx.activeFormatting.value.includes('underline')"
            @click="ctx.actions.toggleDecoration('UNDERLINE')"
          >
            <icon-lucide-underline class="size-3.5" />
          </IconButton>
          <IconButton
            :label="menu.strikethrough"
            size="md"
            :active="ctx.activeFormatting.value.includes('strikethrough')"
            @click="ctx.actions.toggleDecoration('STRIKETHROUGH')"
          >
            <icon-lucide-strikethrough class="size-3.5" />
          </IconButton>
        </div>
      </PanelFieldGroup>
    </PanelSection>
  </TypographyControlsRoot>
</template>
