<script setup lang="ts">
import { LayoutControlsRoot, useI18n } from '@open-pencil/vue'

import AutoLayoutControls from '@/components/properties/LayoutSection/AutoLayoutControls.vue'
import ClipContentControl from '@/components/properties/LayoutSection/ClipContentControl.vue'
import FlexControls from '@/components/properties/LayoutSection/FlexControls.vue'
import GridControls from '@/components/properties/LayoutSection/GridControls.vue'
import PaddingControls from '@/components/properties/LayoutSection/PaddingControls.vue'
import SizeControls from '@/components/properties/LayoutSection/SizeControls.vue'
import { useSectionUI } from '@/components/ui/section'

const { panels } = useI18n()
const sectionCls = useSectionUI()

const CONTAINER_TYPES = ['FRAME', 'COMPONENT', 'COMPONENT_SET', 'INSTANCE']
</script>

<template>
  <LayoutControlsRoot v-slot="ctx">
    <template v-if="ctx.node">
      <div data-test-id="layout-section" :class="sectionCls.wrapper">
        <label class="mb-1.5 block text-[11px] text-muted">{{ panels.layout }}</label>
        <SizeControls />
      </div>

      <template v-if="CONTAINER_TYPES.includes(ctx.node.type)">
        <div :class="sectionCls.wrapper">
          <AutoLayoutControls />

          <template v-if="ctx.node.layoutMode !== 'NONE'">
            <FlexControls v-if="ctx.isFlex" />
            <template v-if="ctx.isGrid">
              <GridControls />
              <PaddingControls />
              <ClipContentControl />
            </template>
          </template>
        </div>
      </template>
    </template>
  </LayoutControlsRoot>
</template>
