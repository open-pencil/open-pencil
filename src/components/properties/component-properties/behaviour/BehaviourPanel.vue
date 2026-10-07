<script setup lang="ts">
import { useBehaviour } from '@open-pencil/vue'

import BehaviourSection from './BehaviourSection.vue'

/** The Behaviour section connected to the selected main component or component set. */
const behaviour = useBehaviour()
</script>

<template>
  <BehaviourSection
    v-if="behaviour.active.value"
    :behaviour="behaviour.behaviour.value"
    @add="behaviour.add"
    @remove="behaviour.remove"
    @bind-value="behaviour.bindValue"
    @bind-text="behaviour.bindText"
    @map-value="behaviour.mapValue"
    @set-number="behaviour.setNumber"
    @bind-part="behaviour.bindPart"
    @bind-states="behaviour.bindStates"
    @map-state="behaviour.mapState"
    @create-text="behaviour.createText"
    @create-variant="behaviour.createVariant"
    @create-part="behaviour.createPart"
    @create-states="behaviour.createStates"
  />
</template>
