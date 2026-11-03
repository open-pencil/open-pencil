import { computed } from 'vue'

import { colorToHex } from '@open-pencil/scene-graph/color'
import { STICKY_COLORS } from '@open-pencil/scene-graph/generated'
import type { Color } from '@open-pencil/scene-graph/primitives'
import { useI18n } from '@open-pencil/vue/i18n'

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

/** FigJam's ten sticky note colours as swatches, and the one a note's colour is. */
export function useStickySwatches(color: () => Color | null) {
  const { panels } = useI18n()
  const swatches = computed(() =>
    (Object.entries(STICKY_COLORS) as [StickyColorName, Color][]).map(([name, value]) => ({
      value: name,
      hex: colorToHex(value),
      label: panels.value[COLOR_LABEL_KEYS[name]]
    }))
  )
  const selected = computed(() => {
    const current = color()
    return (
      swatches.value.find((swatch) => current && swatch.hex === colorToHex(current))?.value ?? null
    )
  })
  return { swatches, selected }
}
