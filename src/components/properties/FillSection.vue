<script setup lang="ts">
import { colorToHexRaw } from '@open-pencil/core'
import { PropertyListRoot, useFillControls, useOkHCL, useI18n } from '@open-pencil/vue'

import FillPicker from '@/components/FillPicker.vue'
import ColorStyleRow from '@/components/properties/ColorStyleRow.vue'
import { useIconButtonUI } from '@/components/ui/icon-button'
import { useSectionUI } from '@/components/ui/section'

import type { Fill } from '@open-pencil/core'

const fillCtx = useFillControls()
const okhcl = useOkHCL()
const { panels } = useI18n()
const sectionCls = useSectionUI()
</script>

<template>
  <PropertyListRoot
    v-slot="{ items, isMixed, activeNode, add, remove, update, patch, toggleVisibility }"
    prop-key="fills"
    :label="panels.fill"
  >
    <div data-test-id="fill-section" :class="sectionCls.wrapper">
      <div class="flex items-center justify-between">
        <label :class="sectionCls.label">{{ panels.fill }}</label>
        <button tabindex="0"
          data-test-id="fill-section-add"
          :class="useIconButtonUI().base"
          @click="add({ ...fillCtx.defaultFill })"
        >
          +
        </button>
      </div>
      <p v-if="isMixed" class="text-[11px] text-muted">{{ panels.mixedFillsHelp }}</p>
      <ColorStyleRow
        v-for="(fill, i) in items as Fill[]"
        :key="`${i}:${fill.visible ? 'visible' : 'hidden'}`"
        :item="fill"
        :index="i"
        :active-node-id="activeNode?.id ?? null"
        :binding-api="fillCtx"
        :visibility-test-id="`fill-visibility-${i}`"
        unbind-test-id="fill-unbind-variable"
        data-test-id="fill-item"
        :data-test-index="i"
        @patch="patch(i, $event)"
        @toggle-visibility="toggleVisibility(i)"
        @remove="remove(i)"
      >
        <FillPicker
          :fill="fill"
          :okhcl="
            activeNode
              ? {
                  fieldFormat: okhcl.getFieldFormat(activeNode, i, 'fill'),
                  fieldOptions: okhcl.fieldOptions,
                  okhcl: okhcl.getFillOkHCLColor(activeNode, i),
                  ...okhcl.getFillPreviewInfo(activeNode, i),
                  setFieldFormat: ($event) => okhcl.setFillFieldFormat(activeNode, i, $event),
                  updateOkHCL: ($event) => okhcl.updateFillOkHCL(activeNode, i, $event)
                }
              : null
          "
          @update="update(i, $event)"
        />

        <template v-if="activeNode && fillCtx.getBoundVariable(activeNode.id, i)">
          <span
            class="min-w-0 flex-1 truncate rounded bg-violet-500/10 px-1 font-mono text-xs text-violet-400"
          >
            {{ fillCtx.getBoundVariable(activeNode.id, i)!.name }}
          </span>
        </template>
        <template v-else>
          <span class="min-w-0 flex-1 font-mono text-xs text-surface">
            <template v-if="fill.type === 'SOLID'">{{ colorToHexRaw(fill.color) }}</template>
            <template v-else-if="fill.type.startsWith('GRADIENT')">{{
              fill.type.replace('GRADIENT_', '')
            }}</template>
            <template v-else>{{ fill.type }}</template>
          </span>
        </template>
      </ColorStyleRow>
    </div>
  </PropertyListRoot>
</template>
