// The token presets the Variables panel offers. Their values load with the import they feed
// (`files.ts`, through `readTokenPresetImport`), so this list stays light.

export const TOKEN_PRESETS = ['tailwind', 'bootstrap'] as const
export type TokenPreset = (typeof TOKEN_PRESETS)[number]

/** Each preset's name: a product name, the same in every language. */
export const TOKEN_PRESET_NAMES: Record<TokenPreset, string> = {
  tailwind: 'Tailwind',
  bootstrap: 'Bootstrap'
}
