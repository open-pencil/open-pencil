<script setup lang="ts">
import { computed } from 'vue'

import { ConstraintsControlRoot, MIXED, useI18n } from '@open-pencil/vue'

import ConstraintsPinControl from '@/components/properties/constraints/ConstraintsPinControl.vue'
import AppSelect from '@/components/ui/select/AppSelect.vue'
import PanelFieldGroup from '@/components/ui/panel/PanelFieldGroup.vue'
import PanelSection from '@/components/ui/panel/PanelSection.vue'
import constraintsTheme from '@/theme/constraints'
import { tv } from 'tailwind-variants'

import type { ConstraintType } from '@open-pencil/scene-graph'

const { panels } = useI18n()
const styles = tv(constraintsTheme)()
type ConstraintSelectValue = ConstraintType | 'MIXED'

const horizontalOptions = computed<Array<{ value: ConstraintSelectValue; label: string }>>(() => [
  { value: 'MIN', label: panels.value.constraintLeft },
  { value: 'CENTER', label: panels.value.constraintCenter },
  { value: 'MAX', label: panels.value.constraintRight },
  { value: 'STRETCH', label: panels.value.constraintLeftAndRight },
  { value: 'SCALE', label: panels.value.constraintScale }
])
const verticalOptions = computed<Array<{ value: ConstraintSelectValue; label: string }>>(() => [
  { value: 'MIN', label: panels.value.constraintTop },
  { value: 'CENTER', label: panels.value.constraintCenter },
  { value: 'MAX', label: panels.value.constraintBottom },
  { value: 'STRETCH', label: panels.value.constraintTopAndBottom },
  { value: 'SCALE', label: panels.value.constraintScale }
])

function optionsWithMixed(
  options: Array<{ value: ConstraintSelectValue; label: string }>,
  mixed: boolean
) {
  return mixed ? [{ value: 'MIXED' as const, label: panels.value.mixed }, ...options] : options
}
</script>

<template>
  <ConstraintsControlRoot v-slot="{ active, horizontal, vertical, actions }">
    <PanelSection v-if="active" :label="panels.constraints" data-property="constraints">
      <div :class="styles.root()">
        <ConstraintsPinControl :horizontal="horizontal" :vertical="vertical" :actions="actions" />
        <div :class="styles.selects()">
          <PanelFieldGroup :label="panels.horizontalConstraint">
            <AppSelect
              :model-value="horizontal === MIXED ? 'MIXED' : horizontal"
              :label="panels.horizontalConstraint"
              :options="optionsWithMixed(horizontalOptions, horizontal === MIXED)"
              @update:model-value="
                (value: ConstraintSelectValue) => value !== 'MIXED' && actions.setHorizontal(value)
              "
            />
          </PanelFieldGroup>
          <PanelFieldGroup :label="panels.verticalConstraint">
            <AppSelect
              :model-value="vertical === MIXED ? 'MIXED' : vertical"
              :label="panels.verticalConstraint"
              :options="optionsWithMixed(verticalOptions, vertical === MIXED)"
              @update:model-value="
                (value: ConstraintSelectValue) => value !== 'MIXED' && actions.setVertical(value)
              "
            />
          </PanelFieldGroup>
        </div>
      </div>
    </PanelSection>
  </ConstraintsControlRoot>
</template>
