<script setup lang="ts">
import { LayoutControlsRoot, useI18n } from '@open-pencil/vue'

import ClipContentControl from '@/components/properties/layout/ClipContentControl.vue'
import FlexControls from '@/components/properties/layout/flex/FlexControls.vue'
import GridControls from '@/components/properties/layout/grid/GridControls.vue'
import LayoutFlowControl from '@/components/properties/layout/LayoutFlowControl.vue'
import PaddingControls from '@/components/properties/layout/padding/PaddingControls.vue'
import SizeControls from '@/components/properties/layout/size/SizeControls.vue'
import TextResizingControl from '@/components/properties/layout/TextResizingControl.vue'
import IconButton from '@/components/ui/button/IconButton.vue'
import PanelSection from '@/components/ui/panel/PanelSection.vue'

const { panels } = useI18n()

const CONTAINER_TYPES = ['FRAME', 'COMPONENT', 'COMPONENT_SET', 'INSTANCE']
</script>

<template>
  <LayoutControlsRoot v-slot="ctx">
    <template v-if="ctx.node">
      <PanelSection :label="ctx.node.layoutMode === 'NONE' ? panels.layout : panels.autoLayout">
        <template v-if="CONTAINER_TYPES.includes(ctx.node.type)" #actions>
          <IconButton
            :label="ctx.node.layoutMode === 'NONE' ? panels.addAutoLayout : panels.removeAutoLayout"
            size="xs"
            :active="ctx.node.layoutMode !== 'NONE'"
            class="data-[state=on]:bg-accent/15"
            @click="
              ctx.editor.setLayoutMode(
                ctx.node.id,
                ctx.node.layoutMode === 'NONE' ? 'VERTICAL' : 'NONE'
              )
            "
          >
            <icon-lucide-layout-panel-top class="size-3.5" />
          </IconButton>
        </template>

        <LayoutFlowControl v-if="CONTAINER_TYPES.includes(ctx.node.type)" />
        <div class="mt-2 mb-1 text-[11px] text-muted">{{ panels.dimensions }}</div>
        <TextResizingControl v-if="ctx.node.type === 'TEXT'" />
        <SizeControls />
        <ClipContentControl
          v-if="CONTAINER_TYPES.includes(ctx.node.type) && ctx.node.layoutMode === 'NONE'"
        />

        <template v-if="CONTAINER_TYPES.includes(ctx.node.type) && ctx.node.layoutMode !== 'NONE'">
          <FlexControls v-if="ctx.isFlex" />
          <template v-if="ctx.isGrid">
            <GridControls />
            <PaddingControls />
            <ClipContentControl />
          </template>
        </template>
      </PanelSection>
    </template>
  </LayoutControlsRoot>
</template>
