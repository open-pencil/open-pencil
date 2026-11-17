import { colorToHex, tryParseColor } from '@open-pencil/scene-graph/color'
import type { IconOptions } from '@open-pencil/scene-graph/icons'

import type { IconOption } from './types'

/** Whether `option` applies to an icon drawn with `options`; see `IconOption`'s `when`. */
export function iconOptionApplies(option: IconOption, options: IconOptions): boolean {
  return !option.when || options[option.when.key] === option.when.value
}

/**
 * `value` as `option` takes it: a number within its range, one of its values, or a color as
 * `#RRGGBB`.
 */
function optionValue(option: IconOption, value: IconOptions[string] | undefined) {
  if ('min' in option)
    return typeof value === 'number' && Number.isFinite(value)
      ? Math.min(option.max, Math.max(option.min, value))
      : option.default
  if ('values' in option)
    return option.values.some((known) => known === value) ? String(value) : option.default
  const color = typeof value === 'string' ? tryParseColor(value) : null
  return color ? colorToHex(color) : option.default
}

/**
 * Every option in `definitions` that applies, set as `options` asks where it is a value the option
 * takes, and defaulted where it is not. Options that do not apply are left out, so an icon records
 * only what draws it.
 */
export function resolveIconOptions(
  definitions: readonly IconOption[],
  options: IconOptions = {}
): Record<string, string | number> {
  const resolved: Record<string, string | number> = {}
  // An option that a later one depends on is listed first, so it is resolved by then.
  for (const option of definitions)
    if (iconOptionApplies(option, resolved))
      resolved[option.key] = optionValue(option, options[option.key])
  return resolved
}
