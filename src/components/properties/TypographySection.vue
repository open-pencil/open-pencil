<script setup lang="ts">
import { ToggleGroupItem, ToggleGroupRoot } from 'reka-ui'

import { TypographyControlsRoot, useI18n } from '@open-pencil/vue'

import FontPicker from '@/components/FontPicker.vue'
import ScrubInput from '@/components/ScrubInput.vue'
import AppSelect from '@/components/ui/AppSelect.vue'
import Tip from '@/components/ui/Tip.vue'
import { useSectionUI } from '@/components/ui/section'
import { loadFont } from '@/app/editor/fonts'

const { panels } = useI18n()
const sectionCls = useSectionUI()
</script>

<template>
  <TypographyControlsRoot v-slot="ctx" :load-font="loadFont">
    <div v-if="ctx.node.value" data-test-id="typography-section" :class="sectionCls.wrapper">
      <label class="mb-1.5 block text-[11px] text-muted">{{ panels.typography }}</label>

      <div class="mb-1.5 flex items-center gap-1.5">
        <FontPicker
          class="min-w-0 flex-1"
          :model-value="ctx.node.value.fontFamily"
          @select="ctx.setFamily"
        />
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
      </div>

      <div class="mb-1.5 flex gap-1.5">
        <AppSelect
          :model-value="ctx.node.value.fontWeight"
          :options="ctx.weights"
          @update:model-value="ctx.setWeight(+$event)"
        />
        <ScrubInput
          class="flex-1"
          :model-value="ctx.node.value.fontSize"
          :min="1"
          :max="1000"
          @update:model-value="ctx.updateProp('fontSize', $event)"
          @commit="(v: number, p: number) => ctx.commitProp('fontSize', v, p)"
        />
      </div>

      <div class="mb-1.5 flex gap-1.5">
        <ScrubInput
          class="flex-1"
          :model-value="
            ctx.node.value.lineHeight ?? Math.round((ctx.node.value.fontSize || 14) * 1.2)
          "
          :min="0"
          @update:model-value="ctx.updateProp('lineHeight', $event)"
          @commit="(v: number, p: number) => ctx.commitProp('lineHeight', v, p)"
        >
          <template #icon>
            <icon-lucide-baseline class="size-3" />
          </template>
        </ScrubInput>
        <ScrubInput
          class="flex-1"
          suffix="%"
          :model-value="ctx.node.value.letterSpacing"
          @update:model-value="ctx.updateProp('letterSpacing', $event)"
          @commit="(v: number, p: number) => ctx.commitProp('letterSpacing', v, p)"
        >
          <template #icon>
            <icon-lucide-a-large-small class="size-3" />
          </template>
        </ScrubInput>
      </div>

      <div class="mb-1.5">
        <label class="mb-1 block text-[11px] text-muted">{{ panels.direction }}</label>
        <AppSelect
          :model-value="ctx.node.value.textDirection"
          :options="[
            { value: 'AUTO', label: panels.auto },
            { value: 'LTR', label: 'LTR' },
            { value: 'RTL', label: 'RTL' }
          ]"
          @update:model-value="ctx.setDirection($event as 'AUTO' | 'LTR' | 'RTL')"
        />
      </div>

      <div class="flex items-center gap-3">
        <ToggleGroupRoot
          type="single"
          class="flex gap-0.5"
          :model-value="ctx.node.value.textAlignHorizontal"
          @update:model-value="ctx.onAlignChange"
        >
          <ToggleGroupItem
            v-for="align in ['LEFT', 'CENTER', 'RIGHT'] as const"
            :key="align"
            :value="align"
            class="flex cursor-pointer items-center justify-center rounded border border-border bg-input px-2 py-1 text-muted hover:bg-hover hover:text-surface data-[state=on]:border-accent data-[state=on]:bg-accent data-[state=on]:text-white"
          >
            <icon-lucide-align-left v-if="align === 'LEFT'" class="size-3.5" />
            <icon-lucide-align-center v-else-if="align === 'CENTER'" class="size-3.5" />
            <icon-lucide-align-right v-else class="size-3.5" />
          </ToggleGroupItem>
        </ToggleGroupRoot>
        <div class="flex gap-0.5">
          <Tip label="Bold (⌘B)">
            <button
              data-test-id="typography-bold-button"
              class="flex cursor-pointer items-center justify-center rounded border border-border bg-input px-2 py-1 font-bold text-muted hover:bg-hover hover:text-surface data-[state=on]:border-accent data-[state=on]:bg-accent data-[state=on]:text-white"
              :data-state="ctx.activeFormatting.value.includes('bold') ? 'on' : 'off'"
              @click="ctx.toggleBold"
            >
              <icon-lucide-bold class="size-3.5" />
            </button>
          </Tip>
          <Tip label="Italic (⌘I)">
            <button
              class="flex cursor-pointer items-center justify-center rounded border border-border bg-input px-2 py-1 text-muted hover:bg-hover hover:text-surface data-[state=on]:border-accent data-[state=on]:bg-accent data-[state=on]:text-white"
              :data-state="ctx.activeFormatting.value.includes('italic') ? 'on' : 'off'"
              @click="ctx.toggleItalic"
            >
              <icon-lucide-italic class="size-3.5" />
            </button>
          </Tip>
          <Tip label="Underline (⌘U)">
            <button
              class="flex cursor-pointer items-center justify-center rounded border border-border bg-input px-2 py-1 text-muted hover:bg-hover hover:text-surface data-[state=on]:border-accent data-[state=on]:bg-accent data-[state=on]:text-white"
              :data-state="ctx.activeFormatting.value.includes('underline') ? 'on' : 'off'"
              @click="ctx.toggleDecoration('UNDERLINE')"
            >
              <icon-lucide-underline class="size-3.5" />
            </button>
          </Tip>
          <Tip label="Strikethrough">
            <button
              class="flex cursor-pointer items-center justify-center rounded border border-border bg-input px-2 py-1 text-muted hover:bg-hover hover:text-surface data-[state=on]:border-accent data-[state=on]:bg-accent data-[state=on]:text-white"
              :data-state="ctx.activeFormatting.value.includes('strikethrough') ? 'on' : 'off'"
              @click="ctx.toggleDecoration('STRIKETHROUGH')"
            >
              <icon-lucide-strikethrough class="size-3.5" />
            </button>
          </Tip>
        </div>
      </div>
    </div>
  </TypographyControlsRoot>
</template>
