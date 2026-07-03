<script setup lang="ts">
import AppSelect from '@/components/ui/AppSelect.vue'
import HsbFields from '@/components/color-picker-panel/HsbFields.vue'
import HslFields from '@/components/color-picker-panel/HslFields.vue'
import OkhclFields from '@/components/color-picker-panel/OkhclFields.vue'
import RgbFields from '@/components/color-picker-panel/RgbFields.vue'
import { useColorPickerPanelContext } from '@/components/color-picker-panel/context'

const ctx = useColorPickerPanelContext()
</script>

<template>
  <div class="flex flex-col gap-2">
    <AppSelect
      class="w-[120px]"
      data-test-id="color-format-select"
      :model-value="ctx.fieldFormat"
      :options="ctx.fieldOptions"
      @update:model-value="ctx.setFieldFormat"
    />

    <div class="min-w-0 flex flex-col gap-2">
      <RgbFields v-if="ctx.fieldFormat === 'rgb'" />
      <HslFields v-else-if="ctx.fieldFormat === 'hsl'" />
      <HsbFields v-else-if="ctx.fieldFormat === 'hsb'" />
      <OkhclFields v-else />
    </div>
  </div>
</template>
