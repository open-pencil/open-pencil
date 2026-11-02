<script setup lang="ts">
import { computed } from 'vue'

import type { MaskType } from '@lawha/scene-graph'
import { useMask } from '@lawha/vue/controls/mask'
import { useI18n } from '@lawha/vue/i18n'

import PanelFieldGroup from '@/components/ui/panel/PanelFieldGroup.vue'
import PanelSection from '@/components/ui/panel/PanelSection.vue'
import AppSelect from '@/components/ui/select/AppSelect.vue'

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
  <PanelSection v-if="active" :label="panels.mask">
    <PanelFieldGroup :label="panels.maskType">
      <AppSelect
        v-model="selectedMaskType"
        :label="panels.maskType"
        :options="maskTypeOptions"
        data-property="mask-type"
      />
    </PanelFieldGroup>
  </PanelSection>
</template>
