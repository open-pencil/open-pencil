<script setup lang="ts">
import { PropertyListRoot, useFillControls, useOkHCL, useI18n } from '@open-pencil/vue'

import FillPicker from '@/components/FillPicker.vue'
import ColorStyleRow from '@/components/properties/ColorStyleRow.vue'
import { fillLabel } from '@/components/properties/fill-label'
import { createFillOkhclAdapter } from '@/components/properties/fill-okhcl'
import { useIconButtonUI } from '@/components/ui/icon-button'
import { useSectionUI } from '@/components/ui/section'

import type { Fill } from '@open-pencil/core/scene-graph'

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
        <button
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
          :okhcl="createFillOkhclAdapter(okhcl, activeNode, i)"
          @update="update(i, $event)"
        />

        <span
          class="min-w-0 flex-1 truncate font-mono text-xs"
          :class="
            activeNode && fillCtx.getBoundVariable(activeNode.id, i)
              ? 'rounded bg-violet-500/10 px-1 text-violet-400'
              : 'text-surface'
          "
        >
          {{ fillLabel(fill, activeNode ? fillCtx.getBoundVariable(activeNode.id, i) : undefined) }}
        </span>
      </ColorStyleRow>
    </div>
  </PropertyListRoot>
</template>
