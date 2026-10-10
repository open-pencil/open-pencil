<script setup lang="ts">
import { computed, reactive } from 'vue'

import type { SceneNode } from '@open-pencil/scene-graph'
import { TypographyControlsRoot, useI18n } from '@open-pencil/vue'

import { loadFont } from '@/app/editor/fonts'
import { appMenuShortcutLabel } from '@/app/shell/menu/shortcut'
import FontPicker from '@/components/font-picker/FontPicker.vue'
import FontSettingsPopover from '@/components/font-settings/FontSettingsPopover.vue'
import NumberField from '@/components/inputs/NumberField.vue'
import SharedStyleField from '@/components/properties/shared-style/SharedStyleField.vue'
import LineHeightField from '@/components/properties/typography/LineHeightField.vue'
import VariableNumberField from '@/components/properties/VariableNumberField.vue'
import IconButton from '@/components/ui/button/IconButton.vue'
import AppCollapsible from '@/components/ui/collapsible/AppCollapsible.vue'
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
const listOptions = computed(() => [
  { value: 'NONE', label: panels.value.listNone },
  { value: 'UNORDERED', label: panels.value.listBulleted },
  { value: 'ORDERED', label: panels.value.listNumbered }
])
const paragraphFields = computed(
  () =>
    [
      { key: 'listSpacing', label: panels.value.listSpacing, property: 'list-spacing' },
      {
        key: 'paragraphSpacing',
        label: panels.value.paragraphSpacing,
        property: 'paragraph-spacing'
      },
      { key: 'paragraphIndent', label: panels.value.paragraphIndent, property: 'paragraph-indent' }
    ] as const
)
/** Opened or closed by hand per layer; otherwise open where the text uses any of it. */
const paragraphsOpenById = reactive<Record<string, boolean>>({})

function paragraphsOpen(node: SceneNode): boolean {
  return (
    paragraphsOpenById[node.id] ??
    (node.textParagraphs.length > 0 ||
      node.listSpacing > 0 ||
      node.paragraphSpacing > 0 ||
      node.paragraphIndent > 0 ||
      node.hangingList)
  )
}
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
      <template #actions>
        <PropertyBindButton field="TEXT" />
      </template>
      <PropertyBoundField field="TEXT" :label="panels.content" />
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

      <PanelGrid :columns="2" class="mb-3">
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

      <PanelGrid :columns="2" class="mb-3">
        <PanelFieldGroup :label="panels.lineHeight">
          <LineHeightField
            :node="ctx.node.value"
            @update="ctx.actions.updateProp('lineHeight', $event)"
            @commit="(v, p) => ctx.actions.commitProp('lineHeight', v, p)"
          />
        </PanelFieldGroup>
        <PanelFieldGroup :label="panels.letterSpacing">
          <VariableNumberField
            suffix="px"
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

      <div class="border-t border-border pt-3">
        <PanelFieldGroup :label="panels.direction" class="mb-3">
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

        <PanelFieldGroup :label="panels.textAlignment" class="mb-3">
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

        <PanelFieldGroup :label="panels.verticalTextAlignment" class="mb-3">
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
          class="mb-3"
        >
          <NumberField
            :model-value="ctx.node.value.maxLines ?? 1"
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

      <div class="border-t border-border py-2">
        <AppCollapsible
          :open="paragraphsOpen(ctx.node.value)"
          :label="panels.listsAndParagraphs"
          :ui="{ trigger: 'text-[11px] text-muted hover:text-surface', icon: 'size-3' }"
          data-property="lists-and-paragraphs"
          @update:open="paragraphsOpenById[ctx.node.value.id] = $event"
        >
          <div class="flex flex-col gap-1.5 pt-2">
            <div class="flex items-center gap-1.5">
              <SegmentedControl
                class="flex-1"
                :model-value="ctx.listType.value ?? ''"
                :options="listOptions"
                :label="panels.listStyle"
                data-property="list-style"
                @change="ctx.actions.setListType($event as 'NONE' | 'ORDERED' | 'UNORDERED')"
              >
                <template #option="{ option }">
                  <icon-lucide-list v-if="option.value === 'UNORDERED'" class="size-3.5" />
                  <icon-lucide-list-ordered
                    v-else-if="option.value === 'ORDERED'"
                    class="size-3.5"
                  />
                  <icon-lucide-minus v-else class="size-3.5" />
                </template>
              </SegmentedControl>
              <IconButton
                :label="panels.hangingLists"
                :active="ctx.node.value.hangingList"
                data-property="hanging-lists"
                @click="ctx.actions.setHangingList(!ctx.node.value.hangingList)"
              >
                <icon-lucide-list-indent-decrease class="size-3.5" />
              </IconButton>
            </div>
            <PanelGrid :columns="3">
              <Tip v-for="field in paragraphFields" :key="field.key" :label="field.label">
                <NumberField
                  :model-value="ctx.node.value[field.key]"
                  :aria-label="field.label"
                  :min="0"
                  :disabled="field.key === 'listSpacing' && ctx.listType.value === 'NONE'"
                  :data-property="field.property"
                  @update:model-value="ctx.actions.updateProp(field.key, Math.max(0, $event))"
                  @commit="
                    (value: number, previous: number) =>
                      ctx.actions.commitProp(field.key, value, previous)
                  "
                >
                  <template #icon>
                    <icon-lucide-between-vertical-start
                      v-if="field.key === 'listSpacing'"
                      class="size-3"
                    />
                    <icon-lucide-pilcrow
                      v-else-if="field.key === 'paragraphSpacing'"
                      class="size-3"
                    />
                    <icon-lucide-arrow-right-to-line v-else class="size-3" />
                  </template>
                </NumberField>
              </Tip>
            </PanelGrid>
          </div>
        </AppCollapsible>
      </div>

      <div class="grid gap-2.5 border-t border-border pt-3">
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
    </PanelSection>
  </TypographyControlsRoot>
</template>
