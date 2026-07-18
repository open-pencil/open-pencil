<script setup lang="ts">
import { computed } from 'vue'

import { TypographyControlsRoot, useI18n } from '@open-pencil/vue'

import FontPicker from '@/components/font-picker/FontPicker.vue'
import FontSettingsPopover from '@/components/FontSettings/FontSettingsPopover.vue'
import NumberField from '@/components/inputs/NumberField.vue'
import SharedStyleField from '@/components/properties/shared-style/SharedStyleField.vue'
import VariableNumberField from '@/components/properties/VariableNumberField.vue'
import AppSelect from '@/components/ui/AppSelect.vue'
import AppSwitch from '@/components/ui/AppSwitch.vue'
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
  { value: 'RIGHT', label: panels.value.alignRight },
  { value: 'JUSTIFIED', label: panels.value.textAlignment }
])
const verticalAlignmentOptions = computed(() => [
  { value: 'TOP', label: panels.value.alignTop },
  { value: 'CENTER', label: panels.value.alignCenterVertically },
  { value: 'BOTTOM', label: panels.value.alignBottom }
])
const textCaseOptions = computed(() => [
  { value: 'ORIGINAL', label: panels.value.textCaseOriginal },
  { value: 'UPPER', label: panels.value.textCaseUpper },
  { value: 'LOWER', label: panels.value.textCaseLower },
  { value: 'TITLE', label: panels.value.textCaseTitle }
])
const truncationOptions = computed(() => [
  { value: 'DISABLED', label: panels.value.truncationDisabled },
  { value: 'ENDING', label: panels.value.truncationEnding }
])
const commonFeatures = computed(() => [
  { tag: 'LIGA', label: panels.value.standardLigatures },
  { tag: 'CALT', label: panels.value.contextualAlternates },
  { tag: 'KERN', label: panels.value.kerning }
])

function featureEnabled(features: Array<{ tag: string; enabled: boolean }>, tag: string) {
  return features.find((feature) => feature.tag === tag)?.enabled ?? true
}
</script>

<template>
  <TypographyControlsRoot v-slot="ctx" :font-loader="fontLoader">
    <PanelSection v-if="ctx.node.value" :label="panels.typography">
      <SharedStyleField kind="text" :label="panels.textStyle" />

      <div class="mb-1.5 flex min-w-0 items-center gap-1.5">
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

      <PanelGrid columns="two" class="mb-1.5">
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

      <PanelGrid columns="two" class="mb-1.5">
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

      <PanelFieldGroup :label="panels.direction" class="mb-1.5">
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

      <PanelFieldGroup :label="panels.textAlignment" class="mb-1.5">
        <SegmentedControl
          :model-value="ctx.node.value.textAlignHorizontal"
          :options="alignmentOptions"
          :label="panels.textAlignment"
          @change="ctx.actions.align($event as 'LEFT' | 'CENTER' | 'RIGHT' | 'JUSTIFIED')"
        >
          <template #option="{ option }">
            <icon-lucide-align-left v-if="option.value === 'LEFT'" class="size-3.5" />
            <icon-lucide-align-center v-else-if="option.value === 'CENTER'" class="size-3.5" />
            <icon-lucide-align-right v-else-if="option.value === 'RIGHT'" class="size-3.5" />
            <icon-lucide-align-justify v-else class="size-3.5" />
          </template>
        </SegmentedControl>
      </PanelFieldGroup>

      <PanelFieldGroup :label="panels.verticalTextAlignment" class="mb-1.5">
        <SegmentedControl
          :model-value="ctx.node.value.textAlignVertical"
          :options="verticalAlignmentOptions"
          :label="panels.verticalTextAlignment"
          @change="ctx.actions.setVerticalAlign($event as 'TOP' | 'CENTER' | 'BOTTOM')"
        >
          <template #option="{ option }">
            <icon-lucide-align-vertical-justify-start
              v-if="option.value === 'TOP'"
              class="size-3.5"
            />
            <icon-lucide-align-vertical-justify-center
              v-else-if="option.value === 'CENTER'"
              class="size-3.5"
            />
            <icon-lucide-align-vertical-justify-end v-else class="size-3.5" />
          </template>
        </SegmentedControl>
      </PanelFieldGroup>

      <PanelGrid columns="two" class="mb-1.5">
        <PanelFieldGroup :label="panels.textCase">
          <AppSelect
            :label="panels.textCase"
            :model-value="ctx.node.value.textCase"
            :options="textCaseOptions"
            @update:model-value="
              ctx.actions.setTextCase($event as 'ORIGINAL' | 'UPPER' | 'LOWER' | 'TITLE')
            "
          />
        </PanelFieldGroup>
        <PanelFieldGroup :label="panels.truncation">
          <AppSelect
            :label="panels.truncation"
            :model-value="ctx.node.value.textTruncation"
            :options="truncationOptions"
            @update:model-value="ctx.actions.setTruncation($event as 'DISABLED' | 'ENDING')"
          />
        </PanelFieldGroup>
      </PanelGrid>

      <PanelFieldGroup
        v-if="ctx.node.value.textTruncation === 'ENDING'"
        :label="panels.maxLines"
        class="mb-1.5"
      >
        <NumberField
          :model-value="ctx.node.value.maxLines ?? 1"
          :aria-label="panels.maxLines"
          :min="1"
          :step="1"
          data-property="max-lines"
          @update:model-value="ctx.actions.updateProp('maxLines', Math.max(1, Math.round($event)))"
          @commit="
            (value: number, previous: number) => ctx.actions.commitProp('maxLines', value, previous)
          "
        />
      </PanelFieldGroup>

      <PanelFieldGroup :label="panels.openTypeFeatures" class="mb-1.5">
        <div class="grid gap-1.5">
          <label
            v-for="feature in commonFeatures"
            :key="feature.tag"
            class="flex items-center justify-between gap-1.5 text-[11px] text-muted"
          >
            <span>{{ feature.label }}</span>
            <AppSwitch
              :model-value="featureEnabled(ctx.node.value.fontFeatures, feature.tag)"
              :label="feature.label"
              :data-property="`font-feature-${feature.tag.toLowerCase()}`"
              @update:model-value="ctx.actions.setFontFeature(feature.tag, $event)"
            />
          </label>
        </div>
      </PanelFieldGroup>

      <PanelFieldGroup :label="panels.textFormatting" :ui="{ container: 'flex-row gap-1.5' }">
        <div class="flex items-center gap-1.5" role="toolbar" :aria-label="panels.textFormatting">
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
