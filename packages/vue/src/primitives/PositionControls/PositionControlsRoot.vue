<script setup lang="ts">
import { computed } from 'vue'

import { MIXED, useNodeProps } from '#vue/controls/node-props/use'

const {
  updateProp,
  commitProp,
  node,
  nodes,
  isMulti,
  active,
  prop: multiProp,
  store
} = useNodeProps()

const xValue = computed(() =>
  isMulti.value ? multiProp('x').value : Math.round(node.value?.x ?? 0)
)
const yValue = computed(() =>
  isMulti.value ? multiProp('y').value : Math.round(node.value?.y ?? 0)
)
const wValue = multiProp('width')
const hValue = multiProp('height')
const rotationValue = computed(() =>
  isMulti.value ? multiProp('rotation').value : Math.round(node.value?.rotation ?? 0)
)
const ids = computed(() => nodes.value.map((n) => n.id))

function align(axis: 'horizontal' | 'vertical', pos: 'min' | 'center' | 'max') {
  store.alignNodes(ids.value, axis, pos)
}

function flip(axis: 'horizontal' | 'vertical') {
  store.flipNodes(ids.value, axis)
}

function rotate(degrees: number) {
  store.rotateNodes(ids.value, degrees)
}

const actions = {
  updateProp,
  commitProp,
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
