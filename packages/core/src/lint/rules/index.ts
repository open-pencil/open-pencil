export { default as noHardcodedColors } from './no/hardcoded-colors'
export { default as noDefaultNames } from './no/default-names'
export { default as preferAutoLayout } from './prefer-auto-layout'
export { default as consistentSpacing } from './consistent-spacing'
export { default as consistentRadius } from './consistent-radius'
export { default as colorContrast } from './color-contrast'
export { default as touchTargetSize } from './touch-target-size'
export { default as textStyleRequired } from './text-style-required'
export { default as minTextSize } from './min-text-size'
export { default as noHiddenLayers } from './no/hidden-layers'
export { default as noDeeplyNested } from './no/deeply-nested'
export { default as noEmptyFrames } from './no/empty-frames'
export { default as pixelPerfect } from './pixel-perfect'
export { default as noGroups } from './no/groups'
export { default as effectStyleRequired } from './effect-style-required'
export { default as noMixedStyles } from './no/mixed-styles'
export { default as noDetachedInstances } from './no/detached-instances'

import colorContrast from './color-contrast'
import consistentRadius from './consistent-radius'
import consistentSpacing from './consistent-spacing'
import effectStyleRequired from './effect-style-required'
import minTextSize from './min-text-size'
import noDeeplyNested from './no/deeply-nested'
import noDefaultNames from './no/default-names'
import noDetachedInstances from './no/detached-instances'
import noEmptyFrames from './no/empty-frames'
import noGroups from './no/groups'
import noHardcodedColors from './no/hardcoded-colors'
import noHiddenLayers from './no/hidden-layers'
import noMixedStyles from './no/mixed-styles'
import pixelPerfect from './pixel-perfect'
import preferAutoLayout from './prefer-auto-layout'
import textStyleRequired from './text-style-required'
import touchTargetSize from './touch-target-size'

import type { Rule } from '#core/lint/types'

export const allRules: Record<string, Rule> = {
  'no-hardcoded-colors': noHardcodedColors,
  'no-default-names': noDefaultNames,
  'prefer-auto-layout': preferAutoLayout,
  'consistent-spacing': consistentSpacing,
  'consistent-radius': consistentRadius,
  'color-contrast': colorContrast,
  'touch-target-size': touchTargetSize,
  'text-style-required': textStyleRequired,
  'min-text-size': minTextSize,
  'no-hidden-layers': noHiddenLayers,
  'no-deeply-nested': noDeeplyNested,
  'no-empty-frames': noEmptyFrames,
  'pixel-perfect': pixelPerfect,
  'no-groups': noGroups,
  'effect-style-required': effectStyleRequired,
  'no-mixed-styles': noMixedStyles,
  'no-detached-instances': noDetachedInstances
}
