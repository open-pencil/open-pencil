<script setup lang="ts">
import { computed } from 'vue'

import { MIXED, TypographyControlsRoot, useI18n, type MixedValue } from '@open-pencil/vue'

import { loadFont } from '@/app/editor/fonts'
import { appMenuShortcutLabel } from '@/app/shell/menu/shortcut'
import FontPicker from '@/components/font-picker/FontPicker.vue'
import FontSettingsPopover from '@/components/font-settings/FontSettingsPopover.vue'
import NumberField from '@/components/inputs/NumberField.vue'
import SharedStyleField from '@/components/properties/shared-style/SharedStyleField.vue'
import LineHeightField from '@/components/properties/typography/LineHeightField.vue'
import VariableNumberField from '@/components/properties/VariableNumberField.vue'
import IconButton from '@/components/ui/button/IconButton.vue'
import Tip from '@/components/ui/overlay/Tip.vue'
import PanelFieldGroup from '@/components/ui/panel/PanelFieldGroup.vue'
import PanelGrid from '@/components/ui/panel/PanelGrid.vue'
import PanelSection from '@/components/ui/panel/PanelSection.vue'
import AppSelect from '@/components/ui/select/AppSelect.vue'
import SegmentedControl from '@/components/ui/select/SegmentedControl.vue'
import AppSwitch from '@/components/ui/toggle/AppSwitch.vue'

import PropertyBindButton from './component-properties/PropertyBindButton.vue'
import PropertyBoundField from './component-properties/PropertyBoundField.vue'

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

/** Empty when the text layers differ, so selects and segmented controls show no choice. */
function picked<T>(value: MixedValue<T>): T | '' {
  return value === MIXED ? '' : value
}
</script>

<template>
  <TypographyControlsRoot v-slot="ctx" :font-loader="fontLoader">
    <PanelSection v-if="ctx.node.value" :label="panels.typography" data-test-id="typography">
      <template v-if="ctx.nodes.value.length === 1" #actions>
        <PropertyBindButton field="TEXT" />
      </template>
      <PropertyBoundField
        v-if="ctx.nodes.value.length === 1"
        field="TEXT"
        :label="panels.content"
      />
      <SharedStyleField kind="text" :label="panels.textStyle" />

      <div class="mb-1.5 flex min-w-0 items-center gap-1.5">
        <FontPicker
          class="min-w-0 flex-1"
          :model-value="picked(ctx.merged('fontFamily'))"
          :label="panels.fontFamily"
          :placeholder="panels.mixed"
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

      <PanelGrid :columns="2" class="mb-3">
        <PanelFieldGroup :label="panels.fontWeight">
          <AppSelect
            :label="panels.fontWeight"
            :model-value="picked(ctx.merged('fontWeight'))"
            :options="ctx.weights"
            :placeholder="panels.mixed"
            @update:model-value="ctx.actions.setWeight(+$event)"
          />
        </PanelFieldGroup>
        <PanelFieldGroup :label="panels.fontSize">
          <VariableNumberField
            :model-value="ctx.merged('fontSize')"
            :aria-label="panels.fontSize"
            :min="1"
            :max="1000"
            :node-id="ctx.node.value.id"
            :node-ids="ctx.nodes.value.map((text) => text.id)"
            binding-path="fontSize"
            @update:model-value="ctx.actions.updateProp('fontSize', $event)"
            @commit="(v: number, p: number) => ctx.actions.commitProp('fontSize', v, p)"
          />
        </PanelFieldGroup>
      </PanelGrid>

      <PanelGrid :columns="2" class="mb-3">
        <PanelFieldGroup :label="panels.lineHeight">
          <LineHeightField
            :nodes="ctx.nodes.value"
            @update="ctx.actions.updateProp('lineHeight', $event)"
            @commit="(v, p) => ctx.actions.commitProp('lineHeight', v, p)"
          />
        </PanelFieldGroup>
        <PanelFieldGroup :label="panels.letterSpacing">
          <VariableNumberField
            suffix="px"
            :model-value="ctx.merged('letterSpacing')"
            :aria-label="panels.letterSpacing"
            :node-id="ctx.node.value.id"
            :node-ids="ctx.nodes.value.map((text) => text.id)"
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

      <div class="border-t border-border pt-3">
        <PanelFieldGroup :label="panels.direction" class="mb-3">
          <AppSelect
            :label="panels.direction"
            :model-value="picked(ctx.merged('textDirection'))"
            :placeholder="panels.mixed"
            :options="[
              { value: 'AUTO', label: panels.auto },
              { value: 'LTR', label: 'LTR' },
              { value: 'RTL', label: 'RTL' }
            ]"
            @update:model-value="ctx.actions.setDirection($event as 'AUTO' | 'LTR' | 'RTL')"
          />
        </PanelFieldGroup>

        <PanelFieldGroup :label="panels.textAlignment" class="mb-3">
          <SegmentedControl
            :model-value="picked(ctx.merged('textAlignHorizontal'))"
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

        <PanelFieldGroup :label="panels.verticalTextAlignment" class="mb-3">
          <SegmentedControl
            :model-value="picked(ctx.merged('textAlignVertical'))"
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
      </div>

      <div class="border-t border-border pt-3">
        <PanelFieldGroup
          :label="panels.textFormatting"
          class="mb-3"
          :ui="{ container: 'flex-row gap-1.5' }"
        >
          <div
            class="inline-flex items-center gap-0.5 rounded bg-panel-field p-0.5 hover:bg-panel-field-hover"
            role="toolbar"
            :aria-label="panels.textFormatting"
          >
            <IconButton
              :label="`${menu.bold} (${appMenuShortcutLabel('text.bold')})`"
              size="xs"
              :active="ctx.activeFormatting.value.includes('bold')"
              @click="ctx.actions.toggleBold"
            >
              <icon-lucide-bold class="size-3.5" />
            </IconButton>
            <IconButton
              :label="`${menu.italic} (${appMenuShortcutLabel('text.italic')})`"
              size="xs"
              :active="ctx.activeFormatting.value.includes('italic')"
              @click="ctx.actions.toggleItalic"
            >
              <icon-lucide-italic class="size-3.5" />
            </IconButton>
            <IconButton
              :label="`${menu.underline} (${appMenuShortcutLabel('text.underline')})`"
              size="xs"
              :active="ctx.activeFormatting.value.includes('underline')"
              @click="ctx.actions.toggleDecoration('UNDERLINE')"
            >
              <icon-lucide-underline class="size-3.5" />
            </IconButton>
            <IconButton
              :label="menu.strikethrough"
              size="xs"
              :active="ctx.activeFormatting.value.includes('strikethrough')"
              @click="ctx.actions.toggleDecoration('STRIKETHROUGH')"
            >
              <icon-lucide-strikethrough class="size-3.5" />
            </IconButton>
          </div>
        </PanelFieldGroup>

        <PanelGrid :columns="2" class="mb-3">
          <PanelFieldGroup :label="panels.textCase">
            <AppSelect
              :label="panels.textCase"
              :model-value="picked(ctx.merged('textCase'))"
              :placeholder="panels.mixed"
              :options="textCaseOptions"
              @update:model-value="
                ctx.actions.setTextCase($event as 'ORIGINAL' | 'UPPER' | 'LOWER' | 'TITLE')
              "
            />
          </PanelFieldGroup>
          <PanelFieldGroup :label="panels.truncation">
            <AppSelect
              :label="panels.truncation"
              :model-value="picked(ctx.merged('textTruncation'))"
              :placeholder="panels.mixed"
              :options="truncationOptions"
              @update:model-value="ctx.actions.setTruncation($event as 'DISABLED' | 'ENDING')"
            />
          </PanelFieldGroup>
        </PanelGrid>

        <PanelFieldGroup
          v-if="ctx.merged('textTruncation') === 'ENDING'"
          :label="panels.maxLines"
          class="mb-3"
        >
          <NumberField
            :model-value="ctx.merged('maxLines') ?? 1"
            :aria-label="panels.maxLines"
            :min="1"
            :step="1"
            data-property="max-lines"
            @update:model-value="
              ctx.actions.updateProp('maxLines', Math.max(1, Math.round($event)))
            "
            @commit="
              (value: number, previous: number) =>
                ctx.actions.commitProp('maxLines', value, previous)
            "
          />
        </PanelFieldGroup>
      </div>

      <div class="grid gap-2.5 border-t border-border pt-3">
        <label
          v-for="feature in commonFeatures"
          :key="feature.tag"
          class="flex items-center justify-between gap-1.5 text-[11px] text-muted"
        >
          <span>{{ feature.label }}</span>
          <AppSwitch
            :model-value="ctx.fontFeature(feature.tag) === true"
            :label="feature.label"
            :data-property="`font-feature-${feature.tag.toLowerCase()}`"
            @update:model-value="ctx.actions.setFontFeature(feature.tag, $event)"
          />
        </label>
      </div>
    </PanelSection>
  </TypographyControlsRoot>
</template>
