<script setup lang="ts">
import { computed } from 'vue'

import { colorToHex } from '@open-pencil/scene-graph/color'
import {
  FIGJAM_COLOR_NAMES,
  figJamColor,
  type FigJamColorName
} from '@open-pencil/scene-graph/figjam'
import { useFigJamMessages } from '@open-pencil/vue/i18n'

import Swatches from './Swatches.vue'

/**
 * FigJam's board palette in its menus' order, closed, when `noneLabel` is given, by a swatch for
 * no colour at all.
 */
const {
  label,
  selected,
  noneLabel,
  none = false
} = defineProps<{
  label: string
  selected: FigJamColorName | null
  noneLabel?: string
  /** Whether no colour is shown, which the none swatch marks. */
  none?: boolean
}>()
const emit = defineEmits<{ select: [name: FigJamColorName]; none: [] }>()
const figjam = useFigJamMessages()

type FigJamMessages = (typeof figjam)['value']

const COLOR_LABEL_KEYS = {
  black: 'colorBlack',
  darkGray: 'colorDarkGray',
  red: 'colorRed',
  orange: 'colorOrange',
  yellow: 'colorYellow',
  green: 'colorGreen',
  teal: 'colorTeal',
  blue: 'colorBlue',
  violet: 'colorViolet',
  pink: 'colorPink',
  white: 'colorWhite',
  gray: 'colorGray',
  lightGray: 'colorLightGray',
  lightRed: 'colorLightRed',
  lightOrange: 'colorLightOrange',
  lightYellow: 'colorLightYellow',
  lightGreen: 'colorLightGreen',
  lightTeal: 'colorLightTeal',
  lightBlue: 'colorLightBlue',
  lightViolet: 'colorLightViolet',
  lightPink: 'colorLightPink'
} as const satisfies Record<FigJamColorName, keyof FigJamMessages>

const swatches = computed(() =>
  FIGJAM_COLOR_NAMES.map((name) => ({
    value: name,
    hex: colorToHex(figJamColor(name)),
    label: figjam.value[COLOR_LABEL_KEYS[name]]
  }))
)
</script>

<template>
  <Swatches
    :label="label"
    :swatches="swatches"
    :selected="selected"
    :none="noneLabel ? { label: noneLabel, active: none } : undefined"
    @select="emit('select', $event)"
    @none="emit('none')"
  />
</template>
