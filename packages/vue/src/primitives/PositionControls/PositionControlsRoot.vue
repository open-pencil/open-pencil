<script setup lang="ts">
import { computed } from 'vue'

import { MIXED } from '#vue/controls/node-props/use'
import { usePosition } from '#vue/controls/position/use'

const {
  updateProp,
  commitProp,
  cancelProp,
  ids,
  align,
  flip,
  rotate,
  isMulti,
  active,
  prop: multiProp,
  panelProp,
  x,
  y,
  rotation
} = usePosition()

const multiX = panelProp('x')
const multiY = panelProp('y')
const multiRotation = panelProp('rotation')
const xValue = computed(() => (isMulti.value ? multiX.value : x.value))
const yValue = computed(() => (isMulti.value ? multiY.value : y.value))
const wValue = multiProp('width')
const hValue = multiProp('height')
const rotationValue = computed(() => (isMulti.value ? multiRotation.value : rotation.value))
const actions = {
  updateProp,
  commitProp,
  cancelProp,
  align,
  flip,
  rotate
}
</script>

<template>
  <slot
    :active="active"
    :is-multi="isMulti"
    :ids="ids"
    :x-value="xValue"
    :y-value="yValue"
    :w-value="wValue"
    :h-value="hValue"
    :rotation-value="rotationValue"
    :mixed="MIXED"
    :actions="actions"
  />
</template>
