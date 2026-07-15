<script setup lang="ts">
import { computed } from 'vue'

import { useI18n, useMask } from '@open-pencil/vue'

import AppSelect from '@/components/ui/AppSelect.vue'
import PanelSection from '@/components/ui/panel/PanelSection.vue'
import Tip from '@/components/ui/Tip.vue'

import type { MaskType } from '@open-pencil/scene-graph'

const { panels } = useI18n()
const { active, maskType, setMaskType } = useMask()

const maskTypeOptions = computed<Array<{ value: MaskType; label: string }>>(() => [
  { value: 'ALPHA', label: panels.value.maskTypeAlpha },
  { value: 'VECTOR', label: panels.value.maskTypeVector },
  { value: 'LUMINANCE', label: panels.value.maskTypeLuminance }
])

const selectedMaskType = computed<MaskType>({
  get: () => maskType.value,
  set: setMaskType
})
</script>

<template>
  <PanelSection v-if="active" :label="panels.mask" data-test-id="mask-section">
    <Tip :label="panels.maskType">
      <AppSelect
        class="w-full"
        :label="panels.maskType"
        v-model="selectedMaskType"
        :options="maskTypeOptions"
        data-test-id="mask-type-select"
      />
    </Tip>
  </PanelSection>
</template>
