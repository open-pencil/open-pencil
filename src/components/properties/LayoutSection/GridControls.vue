<script setup lang="ts">
import AppSelect from '@/components/ui/AppSelect.vue'
import NumberField from '@/components/inputs/NumberField.vue'
import IconButton from '@/components/ui/IconButton.vue'
import { useI18n, useLayoutControlsContext } from '@open-pencil/vue'

import type { GridTrackProp } from '@/components/properties/LayoutSection/types'
import type { GridTrackSizing } from '@open-pencil/scene-graph'

const ctx = useLayoutControlsContext()

const { panels } = useI18n()
const trackProps: GridTrackProp[] = ['gridTemplateColumns', 'gridTemplateRows']

function defaultTrackValue(sizing: GridTrackSizing): number {
  if (sizing === 'FR') return 1
  if (sizing === 'FIXED') return 100
  return 0
}
</script>

<template>
  <template v-for="trackProp in trackProps" :key="trackProp">
    <div class="mt-2">
      <div class="mb-1 flex items-center justify-between">
        <label class="text-[11px] text-muted">
          {{ trackProp === 'gridTemplateColumns' ? panels.columns : panels.rows }}
        </label>
        <IconButton @click="ctx.addTrack(trackProp)">
          <icon-lucide-plus class="size-3.5" />
        </IconButton>
      </div>
      <div class="flex flex-col gap-1">
        <div v-for="(track, i) in ctx.node[trackProp]" :key="i" class="flex items-center gap-1">
          <NumberField
            v-if="track.sizing !== 'AUTO'"
            class="flex-1"
            :icon="`${trackProp === 'gridTemplateColumns' ? 'C' : 'R'}${i + 1}`"
            :model-value="track.value"
            :min="track.sizing === 'FR' ? 1 : 0"
            :suffix="track.sizing === 'FR' ? 'fr' : 'px'"
            @update:model-value="ctx.updateGridTrack(trackProp, i, { value: $event })"
          />
          <span v-else class="flex-1 px-1 text-xs text-muted">{{ ctx.trackLabel(track) }}</span>
          <AppSelect
            :model-value="track.sizing"
            :options="ctx.trackSizingOptions"
            @update:model-value="
              ctx.updateGridTrack(trackProp, i, {
                sizing: $event as GridTrackSizing,
                value: defaultTrackValue($event as GridTrackSizing)
              })
            "
          />
          <IconButton v-if="ctx.node[trackProp].length > 1" @click="ctx.removeTrack(trackProp, i)">
            <icon-lucide-x class="size-3.5" />
          </IconButton>
        </div>
      </div>
    </div>
  </template>

  <div class="mt-2 grid grid-cols-2 gap-1.5">
    <NumberField
      :model-value="Math.round(ctx.node.gridColumnGap)"
      :min="0"
      @update:model-value="ctx.updateProp('gridColumnGap', $event)"
      @commit="(v: number, p: number) => ctx.commitProp('gridColumnGap', v, p)"
    >
      <template #icon>
        <icon-lucide-move-horizontal class="size-3" />
      </template>
    </NumberField>
    <NumberField
      :model-value="Math.round(ctx.node.gridRowGap)"
      :min="0"
      @update:model-value="ctx.updateProp('gridRowGap', $event)"
      @commit="(v: number, p: number) => ctx.commitProp('gridRowGap', v, p)"
    >
      <template #icon>
        <icon-lucide-move-vertical class="size-3" />
      </template>
    </NumberField>
  </div>
</template>
