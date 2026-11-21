import { computed } from 'vue'

import { colorToHex } from '@open-pencil/scene-graph/color'
import { STICKY_COLORS } from '@open-pencil/scene-graph/generated'
import type { Color } from '@open-pencil/scene-graph/primitives'
import { useColorCSS } from '@open-pencil/vue/controls/color-model'
import { useMessages } from '@open-pencil/vue/i18n'

export type StickyColorName = keyof typeof STICKY_COLORS

const COLOR_LABEL_KEYS = {
  white: 'stickyColorWhite',
  gray: 'stickyColorGray',
  red: 'stickyColorRed',
  orange: 'stickyColorOrange',
  yellow: 'stickyColorYellow',
  green: 'stickyColorGreen',
  teal: 'stickyColorTeal',
  blue: 'stickyColorBlue',
  violet: 'stickyColorViolet',
  pink: 'stickyColorPink'
} as const satisfies Record<StickyColorName, string>

const STICKY_ENTRIES = Object.entries(STICKY_COLORS) as [StickyColorName, Color][]

/** FigJam's ten sticky note colours as swatches, and the one a note's colour is. */
export function useStickySwatches(color: () => Color | null) {
  const panels = useMessages('panels')
  const colorCSS = useColorCSS()
  const swatches = computed(() =>
    STICKY_ENTRIES.map(([name, value]) => ({
      value: name,
      css: colorCSS(value),
      label: panels.value[COLOR_LABEL_KEYS[name]]
    }))
  )
  const selected = computed(() => {
    const current = color()
    return (
      STICKY_ENTRIES.find(
        ([, value]) => current && colorToHex(value) === colorToHex(current)
      )?.[0] ?? null
    )
  })
  return { swatches, selected }
}
