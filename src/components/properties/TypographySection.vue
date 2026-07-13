<script setup lang="ts">
import { TypographyControlsRoot, useI18n } from '@open-pencil/vue'

import FontPicker from '@/components/font-picker/FontPicker.vue'
import FontSettingsPopover from '@/components/FontSettings/FontSettingsPopover.vue'
import VariableNumberField from '@/components/properties/VariableNumberField.vue'
import AppSelect from '@/components/ui/AppSelect.vue'
import IconButton from '@/components/ui/IconButton.vue'
import PanelRow from '@/components/ui/panel/PanelRow.vue'
import PanelSection from '@/components/ui/panel/PanelSection.vue'
import Tip from '@/components/ui/Tip.vue'
import { loadFont } from '@/app/editor/fonts'
import { appMenuShortcutLabel } from '@/app/shell/menu/shortcut'

const { panels, menu } = useI18n()
const fontLoader = { load: loadFont }
</script>

<template>
  <TypographyControlsRoot v-slot="ctx" :font-loader="fontLoader">
    <PanelSection
      v-if="ctx.node.value"
      :label="panels.typography"
      data-test-id="typography-section"
    >
      <PanelRow class="mb-1.5">
        <FontPicker
          class="min-w-0 flex-1"
          :model-value="ctx.node.value.fontFamily"
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
            data-test-id="typography-missing-font"
            class="size-3.5 shrink-0 text-[var(--color-warning-action)]"
          />
        </Tip>
      </PanelRow>

      <PanelRow cols="two" class="mb-1.5">
        <AppSelect
          :model-value="ctx.node.value.fontWeight"
          :options="ctx.weights"
          @update:model-value="ctx.actions.setWeight(+$event)"
        />
        <VariableNumberField
          class="flex-1"
          :model-value="ctx.node.value.fontSize"
          :min="1"
          :max="1000"
          :node-id="ctx.node.value.id"
          binding-path="fontSize"
          @update:model-value="ctx.actions.updateProp('fontSize', $event)"
          @commit="(v: number, p: number) => ctx.actions.commitProp('fontSize', v, p)"
        />
      </PanelRow>

      <PanelRow cols="two" class="mb-1.5">
        <VariableNumberField
          class="flex-1"
          :model-value="
            ctx.node.value.lineHeight ?? Math.round((ctx.node.value.fontSize || 14) * 1.2)
          "
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
        <VariableNumberField
          class="flex-1"
          suffix="%"
          :model-value="ctx.node.value.letterSpacing"
          :node-id="ctx.node.value.id"
          binding-path="letterSpacing"
          @update:model-value="ctx.actions.updateProp('letterSpacing', $event)"
          @commit="(v: number, p: number) => ctx.actions.commitProp('letterSpacing', v, p)"
        >
          <template #icon>
            <icon-lucide-a-large-small class="size-3" />
          </template>
        </VariableNumberField>
      </PanelRow>

      <div class="mb-1.5">
        <label class="mb-1 block text-[11px] text-muted">{{ panels.direction }}</label>
        <AppSelect
          :model-value="ctx.node.value.textDirection"
          :options="[
            { value: 'AUTO', label: panels.auto },
            { value: 'LTR', label: 'LTR' },
            { value: 'RTL', label: 'RTL' }
          ]"
          @update:model-value="ctx.actions.setDirection($event as 'AUTO' | 'LTR' | 'RTL')"
        />
      </div>

      <PanelRow class="gap-3">
        <PanelRow gap="sm">
          <IconButton
            :label="panels.alignLeft"
            size="md"
            :active="ctx.node.value.textAlignHorizontal === 'LEFT'"
            @click="ctx.actions.align('LEFT')"
          >
            <icon-lucide-align-left class="size-3.5" />
          </IconButton>
          <IconButton
            :label="panels.alignCenterHorizontally"
            size="md"
            :active="ctx.node.value.textAlignHorizontal === 'CENTER'"
            @click="ctx.actions.align('CENTER')"
          >
            <icon-lucide-align-center class="size-3.5" />
          </IconButton>
          <IconButton
            :label="panels.alignRight"
            size="md"
            :active="ctx.node.value.textAlignHorizontal === 'RIGHT'"
            @click="ctx.actions.align('RIGHT')"
          >
            <icon-lucide-align-right class="size-3.5" />
          </IconButton>
        </PanelRow>
        <PanelRow gap="sm">
          <IconButton
            :label="`${menu.bold} (${appMenuShortcutLabel('text.bold')})`"
            size="md"
            :active="ctx.activeFormatting.value.includes('bold')"
            data-test-id="typography-bold-button"
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
        </PanelRow>
      </PanelRow>
    </PanelSection>
  </TypographyControlsRoot>
</template>
