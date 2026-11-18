<script setup lang="ts">
import ChannelFields from '@/components/color-picker-panel/ChannelFields.vue'
import { useColorPickerPanelContext } from '@/components/color-picker-panel/context'
import HsbSliders from '@/components/color-picker-panel/HsbSliders.vue'
import HslSliders from '@/components/color-picker-panel/HslSliders.vue'
import OkhclFields from '@/components/color-picker-panel/OkhclFields.vue'
import AppSelect from '@/components/ui/select/AppSelect.vue'

const ctx = useColorPickerPanelContext()
</script>

<template>
  <!-- As in Figma, the format and its values share a row. -->
  <div class="flex items-center gap-1">
    <AppSelect
      :ui="{ trigger: 'w-16 flex-none' }"
      data-test-id="color-format-select"
      :model-value="ctx.fieldFormat"
      :options="ctx.fieldOptions"
      @update:model-value="ctx.setFieldFormat"
    />
    <ChannelFields class="flex-1" />
  </div>
  <HslSliders v-if="ctx.fieldFormat === 'hsl'" />
  <HsbSliders v-else-if="ctx.fieldFormat === 'hsb'" />
  <OkhclFields v-else-if="ctx.fieldFormat === 'okhcl'" />
</template>
