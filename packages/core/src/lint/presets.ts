import type { Severity } from './types'

type RuleConfig = Severity | { severity: Severity; options?: Record<string, unknown> }
export interface Preset {
  rules: Record<string, RuleConfig>
}

/**
 * Errors and warnings mean a layer is likely wrong for people using the design: low contrast,
 * small targets or text, spacing off the scale. Token adoption and structure hygiene are
 * suggestions, which interfaces can list without marking every layer that has one.
 */
export const recommended: Preset = {
  rules: {
    'no-hardcoded-colors': 'info',
    'no-default-names': 'info',
    'prefer-auto-layout': 'info',
    'consistent-spacing': 'info',
    'consistent-radius': 'info',
    'color-contrast': 'error',
    // WCAG 2.2 AA minimum; Strict and Accessibility keep the rule's 44×44 (AAA).
    'touch-target-size': { severity: 'warning', options: { minSize: 24 } },
    'text-style-required': 'info',
    'min-text-size': 'warning',
    'no-hidden-layers': 'info',
    'no-deeply-nested': 'info',
    'no-empty-frames': 'info',
    'pixel-perfect': 'info',
    'no-groups': 'info',
    'effect-style-required': 'info',
    'no-mixed-styles': 'info',
    'no-detached-instances': 'off'
  }
}

export const strict: Preset = {
  rules: Object.fromEntries(
    Object.keys(recommended.rules).map((id) => [id, id === 'color-contrast' ? 'error' : 'warning'])
  )
}
export const accessibility: Preset = {
  rules: {
    'color-contrast': 'error',
    'touch-target-size': 'error',
    'min-text-size': 'error',
    'no-hardcoded-colors': 'off',
    'no-default-names': 'off',
    'prefer-auto-layout': 'off',
    'consistent-spacing': 'off',
    'consistent-radius': 'off',
    'text-style-required': 'off',
    'no-hidden-layers': 'off',
    'no-deeply-nested': 'off',
    'no-empty-frames': 'off',
    'pixel-perfect': 'off',
    'no-groups': 'off',
    'effect-style-required': 'off',
    'no-mixed-styles': 'off',
    'no-detached-instances': 'off'
  }
}
export const presets: Record<string, Preset> = { recommended, strict, accessibility }
