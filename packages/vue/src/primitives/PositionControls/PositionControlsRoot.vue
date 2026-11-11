<script setup lang="ts">
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
  panelProp,
  rotates,
  inAutoLayout,
  ignoresAutoLayout,
  toggleIgnoreAutoLayout
} = usePosition()

const xValue = panelProp('x')
const yValue = panelProp('y')
const wValue = panelProp('width')
const hValue = panelProp('height')
const rotationValue = panelProp('rotation')
const actions = {
  updateProp,
  commitProp,
  cancelProp,
  align,
  flip,
  rotate,
  toggleIgnoreAutoLayout
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
    :rotates="rotates"
    :in-auto-layout="inAutoLayout"
    :ignores-auto-layout="ignoresAutoLayout"
    :mixed="MIXED"
    :actions="actions"
  />
</template>
