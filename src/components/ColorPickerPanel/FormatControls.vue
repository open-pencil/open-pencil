<script setup lang="ts">
import AppSelect from '@/components/ui/AppSelect.vue'
import HsbFields from '@/components/ColorPickerPanel/HsbFields.vue'
import HslFields from '@/components/ColorPickerPanel/HslFields.vue'
import OkhclFields from '@/components/ColorPickerPanel/OkhclFields.vue'
import RgbFields from '@/components/ColorPickerPanel/RgbFields.vue'
import { useColorPickerPanelContext } from '@/components/ColorPickerPanel/context'

const ctx = useColorPickerPanelContext()
</script>

<template>
  <div class="flex flex-col gap-2">
    <AppSelect
      class="w-[120px]"
      test-id="color-format-select"
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
