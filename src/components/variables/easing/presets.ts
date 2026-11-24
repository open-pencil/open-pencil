import type { Easing, EasingCurve } from '@open-pencil/scene-graph'
import { easingText, isSpringCurve } from '@open-pencil/scene-graph/variables'
import type { MessagesOf } from '@open-pencil/vue/i18n'

type EasingMessages = MessagesOf<'variables/easing'>
type PresetMessage = keyof EasingMessages

/** The curves the Curve tab offers, in Figma's order, each with the message naming it. */
export const CURVE_PRESETS: ReadonlyArray<{ curve: EasingCurve; message: PresetMessage }> = [
  { curve: 'HOLD', message: 'hold' },
  { curve: 'LINEAR', message: 'linear' },
  { curve: 'EASE_IN', message: 'easeIn' },
  { curve: 'OUT_CUBIC', message: 'easeOut' },
  { curve: 'INOUT_CUBIC', message: 'easeInAndOut' },
  { curve: 'IN_BACK_CUBIC', message: 'easeInBack' },
  { curve: 'OUT_BACK_CUBIC', message: 'easeOutBack' },
  { curve: 'INOUT_BACK_CUBIC', message: 'easeInAndOutBack' },
  { curve: 'CUSTOM_CUBIC', message: 'customBezier' }
]

/** The springs the Spring tab offers, in Figma's order. */
export const SPRING_PRESETS: ReadonlyArray<{ curve: EasingCurve; message: PresetMessage }> = [
  { curve: 'GENTLE_SPRING', message: 'gentle' },
  { curve: 'SPRING_PRESET_ONE', message: 'quick' },
  { curve: 'SPRING_PRESET_TWO', message: 'bouncy' },
  { curve: 'SPRING_PRESET_THREE', message: 'slow' },
  { curve: 'CUSTOM_SPRING', message: 'customSpring' }
]

/**
 * The preset a value is listed as: a new variable's `IN_CUBIC` is Ease in, as Figma shows it, and
 * an old file's plain `SPRING` is a custom spring.
 */
export function listedCurve(easing: Easing): EasingCurve {
  if (easing.easing === 'IN_CUBIC') return 'EASE_IN'
  if (easing.easing === 'SPRING') return 'CUSTOM_SPRING'
  return easing.easing
}

export function presetsFor(easing: Easing) {
  return isSpringCurve(easing.easing) ? SPRING_PRESETS : CURVE_PRESETS
}

/**
 * An easing as the list names it: a preset by its translated name, a custom curve or spring by
 * its numbers, as Figma's table writes them.
 */
export function easingLabel(easing: Easing, messages: EasingMessages): string {
  const curve = listedCurve(easing)
  const preset = [...CURVE_PRESETS, ...SPRING_PRESETS].find(
    (entry) => entry.curve === curve && curve !== 'CUSTOM_CUBIC' && curve !== 'CUSTOM_SPRING'
  )
  return preset ? messages[preset.message] : easingText(easing)
}
